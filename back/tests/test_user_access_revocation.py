"""Removing a user revokes every session without losing historical references."""
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import select

from pg_client_mixin import PgClientTestCase
from app import models, security
from app.main import app


class TestUserAccessRevocation(PgClientTestCase):
    def setUp(self):
        super().setUp()
        self.tenant = models.Tenant(name="Access revocation test")
        self.session.add(self.tenant)
        self.session.commit()
        self.owner = self.make_user("revocation-owner@amvara.de", models.UserRole.owner)
        self.target = self.make_user("revocation-target@amvara.de", models.UserRole.admin)

    def make_user(self, email, role, tenant_id=None):
        user = models.User(email=email, hashed_password=security.get_password_hash("synthetic-revocation-password"),
                           role=role, tenant_id=tenant_id or self.tenant.id)
        self.session.add(user)
        self.session.commit()
        return user

    def headers(self, user):
        token = security.create_access_token({"sub": user.email, "tenant_id": user.tenant_id,
                                               "token_version": user.token_version}, timedelta(minutes=30))
        return {"Authorization": f"Bearer {token}"}

    def test_delete_preserves_history_and_revokes_login_access_refresh_and_otp(self):
        first = TestClient(app)
        second = TestClient(app)
        credentials = {"username": self.target.email, "password": "synthetic-revocation-password"}
        for device in (first, second):
            self.assertEqual(device.post("/token", data=credentials).status_code, 200)
            self.assertEqual(device.get("/users").status_code, 200)
        pending = {"sub": self.target.email, "tenant_id": self.target.tenant_id, "token_version": 0}
        bearer = self.headers(self.target)
        history = self.session.exec(select(models.LoginEvent).where(models.LoginEvent.user_id == self.target.id)).all()
        self.assertEqual(len(history), 2)
        response = self.client.delete(f"/users/{self.target.id}", headers=self.headers(self.owner))
        self.assertEqual(response.status_code, 200, response.text)
        self.session.refresh(self.target)
        self.assertFalse(self.target.is_active)
        self.assertEqual(self.target.token_version, 1)
        self.assertIsNone(security._user_from_payload(self.session, pending))
        self.assertEqual(self.client.get("/users", headers=bearer).status_code, 401)
        for device in (first, second):
            self.assertIsNone(device.get("/users/me").json())
            self.assertEqual(device.get("/users").status_code, 401)
            self.assertEqual(device.post("/refresh").status_code, 401)
            self.assertEqual(device.post("/token", data=credentials).status_code, 401)
        self.assertEqual(len(self.session.exec(select(models.LoginEvent).where(models.LoginEvent.user_id == self.target.id)).all()), 2)
        listed = self.client.get("/users", headers=self.headers(self.owner)).json()
        self.assertNotIn(self.target.id, [user["id"] for user in listed])
        self.assertEqual(self.client.put(f"/users/{self.target.id}", headers=self.headers(self.owner), json={"full_name":"Changed"}).status_code, 404)

    def test_owner_can_remove_another_owner_but_not_self(self):
        self.target.role = models.UserRole.owner
        self.session.add(self.target)
        self.session.commit()
        headers = self.headers(self.owner)
        self.assertEqual(self.client.delete(f"/users/{self.target.id}", headers=headers).status_code, 200)
        self.assertEqual(self.client.delete(f"/users/{self.owner.id}", headers=headers).status_code, 400)
        self.session.refresh(self.owner)
        self.assertTrue(self.owner.is_active)

    def test_admin_cannot_remove_users(self):
        response = self.client.delete(f"/users/{self.owner.id}", headers=self.headers(self.target))
        self.assertEqual(response.status_code, 403)

    def test_cross_tenant_deletion_is_rejected(self):
        other = models.Tenant(name="Other revocation tenant")
        self.session.add(other)
        self.session.commit()
        outsider = self.make_user("revocation-outsider@amvara.de", models.UserRole.owner, other.id)
        response = self.client.delete(f"/users/{self.target.id}", headers=self.headers(outsider))
        self.assertEqual(response.status_code, 404)
        self.session.refresh(self.target)
        self.assertTrue(self.target.is_active)
