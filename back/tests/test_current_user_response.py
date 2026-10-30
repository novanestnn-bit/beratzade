from pg_client_mixin import PgClientTestCase
from app import models, security


class TestCurrentUserResponse(PgClientTestCase):
    def test_anonymous_user_stays_null(self):
        response = self.client.get('/users/me')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json())

    def test_user_response_excludes_authentication_internals(self):
        tenant = models.Tenant(name='Public user response test')
        self.session.add(tenant)
        self.session.commit()
        self.session.refresh(tenant)
        user = models.User(
            tenant_id=tenant.id, email='readiness-profile@amvara.de',
            hashed_password=security.get_password_hash('synthetic-test-password'),
            otp_secret='synthetic-test-otp', role=models.UserRole.waiter,
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        token = security.create_access_token({'sub': user.email, 'tenant_id': tenant.id, 'token_version': user.token_version})
        response = self.client.get('/users/me', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {'id', 'email', 'full_name', 'role', 'tenant_id', 'provider_id'})
