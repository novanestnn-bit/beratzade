from fastapi.testclient import TestClient

from pg_client_mixin import PgClientTestCase
from app import models, security
from app.main import app


class TestMultiDeviceLogin(PgClientTestCase):
    def test_case_insensitive_login_keeps_both_device_sessions_valid(self):
        tenant = models.Tenant(name="Multi-device login test")
        self.session.add(tenant)
        self.session.commit()
        self.session.refresh(tenant)

        user = models.User(
            email="Ferhat.Login+Devices@amvara.de",
            hashed_password=security.get_password_hash("synthetic-device-login-password"),
            tenant_id=tenant.id,
            role=models.UserRole.owner,
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)

        first_device = TestClient(app)
        second_device = TestClient(app)
        first_login = first_device.post(
            "/token",
            data={
                "username": "Ferhat.Login+Devices@amvara.de",
                "password": "synthetic-device-login-password",
            },
        )
        second_login = second_device.post(
            "/token",
            data={
                "username": "  ferhat.login+devices@AMVARA.DE  ",
                "password": "synthetic-device-login-password",
            },
        )

        assert first_login.status_code == 200
        assert second_login.status_code == 200
        assert first_device.get("/users/me").json()["id"] == user.id
        assert second_device.get("/users/me").json()["id"] == user.id
        assert user.token_version == 0
