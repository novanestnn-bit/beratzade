from unittest.mock import patch
from uuid import uuid4
from sqlmodel import select
from pg_client_mixin import PgClientTestCase
from app import models, security


class TestDurableOperations(PgClientTestCase):
    def setUp(self):
        super().setUp()
        self.tenant = models.Tenant(name='Durable operations isolated')
        self.session.add(self.tenant)
        self.session.flush()
        self.table = models.Table(name='Durable table', tenant_id=self.tenant.id, is_active=True, order_pin='1234')
        self.product = models.Product(name='Isolated dish', tenant_id=self.tenant.id, price_cents=1500)
        self.owner = models.User(email=uuid4().hex+'@amvara.de', hashed_password='unused', role=models.UserRole.owner, tenant_id=self.tenant.id)
        self.kitchen = models.User(email=uuid4().hex+'@amvara.de', hashed_password='unused', role=models.UserRole.kitchen, tenant_id=self.tenant.id)
        self.session.add_all([self.table, self.product, self.owner, self.kitchen])
        self.session.commit()
        for row in [self.table, self.product, self.owner, self.kitchen]:
            self.session.refresh(row)
        self.headers = self.headers_for(self.owner)

    def headers_for(self, user):
        return {'Authorization': 'Bearer '+security.create_access_token({'sub': user.email, 'tenant_id': user.tenant_id, 'provider_id': None, 'token_version': user.token_version})}

    def call(self, key='durable-call-key', message='Please come'):
        return self.client.post(f'/menu/{self.table.token}/call-waiter', json={'idempotency_key': key, 'message': message})

    def test_call_persists_and_retry_does_not_duplicate(self):
        first = self.call()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self.call().json()['request_id'], first.json()['request_id'])
        self.assertEqual(len(self.session.exec(select(models.ServiceRequest).where(models.ServiceRequest.tenant_id == self.tenant.id)).all()), 1)
        self.assertEqual(self.call(message='Changed').status_code, 409)
        data = self.client.get('/service-requests', headers=self.headers).json()
        self.assertEqual(data[0]['message'], 'Please come')
        self.assertNotIn('table_token', data[0])

    def test_durable_call_survives_optional_event_failure(self):
        with patch('app.main.publish_order_update', side_effect=RuntimeError('Event unavailable')):
            self.assertEqual(self.call().status_code, 200)
        response = self.call()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.session.exec(select(models.ServiceRequest).where(models.ServiceRequest.tenant_id == self.tenant.id)).all()), 1)

    def test_request_status_is_persistent_and_resolved_cannot_reopen(self):
        identifier = self.call().json()['request_id']
        for status in ['acknowledged', 'resolved']:
            response = self.client.patch(f'/service-requests/{identifier}', json={'status': status}, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['status'], status)
        self.assertEqual(self.client.get('/service-requests', headers=self.headers).json(), [])
        self.assertEqual(self.client.get('/service-requests?include_resolved=true', headers=self.headers).json()[0]['status'], 'resolved')
        self.assertEqual(self.client.patch(f'/service-requests/{identifier}', json={'status':'acknowledged'}, headers=self.headers).status_code, 409)

    def test_request_permissions_and_cross_tenant_isolation(self):
        identifier = self.call().json()['request_id']
        self.assertEqual(self.client.get('/service-requests').status_code, 401)
        self.assertEqual(self.client.get('/service-requests', headers=self.headers_for(self.kitchen)).status_code, 403)
        other = models.Tenant(name='Other isolated tenant')
        self.session.add(other); self.session.flush()
        user = models.User(email=uuid4().hex+'@amvara.de', hashed_password='unused', role=models.UserRole.owner, tenant_id=other.id)
        self.session.add(user); self.session.commit(); self.session.refresh(user)
        headers = self.headers_for(user)
        self.assertEqual(self.client.get('/service-requests', headers=headers).json(), [])
        self.assertEqual(self.client.patch(f'/service-requests/{identifier}', json={'status':'resolved'}, headers=headers).status_code, 404)

    def test_order_receipt_prevents_repeated_items_and_conflicting_key(self):
        body = {'idempotency_key': 'order-repeat-key', 'pin':'1234', 'session_id':'isolated-device', 'items':[{'product_id':self.product.id,'source':'product','quantity':1}]}
        first = self.client.post(f'/menu/{self.table.token}/order', json=body)
        self.assertEqual(first.status_code, 200)
        repeated = self.client.post(f'/menu/{self.table.token}/order', json=body)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.json()['order_id'], first.json()['order_id'])
        self.assertTrue(repeated.json()['duplicate'])
        items = self.session.exec(select(models.OrderItem).where(models.OrderItem.order_id == first.json()['order_id'])).all()
        self.assertEqual(sum(item.quantity for item in items), 1)
        body['items'][0]['quantity'] = 2
        self.assertEqual(self.client.post(f'/menu/{self.table.token}/order', json=body).status_code, 409)

    def test_payment_request_replay_does_not_append_notes_twice(self):
        order = models.Order(tenant_id=self.tenant.id,table_id=self.table.id,status=models.OrderStatus.pending)
        self.session.add(order); self.session.commit(); self.session.refresh(order)
        url=f'/menu/{self.table.token}/order/{order.id}/request-payment'
        body={'payment_method':'cash','message':'Cash please','idempotency_key':'payment-request-key'}
        first=self.client.post(url,json=body)
        self.assertEqual(first.status_code,200)
        self.assertEqual(self.client.post(url,json=body).json()['request_id'],first.json()['request_id'])
        self.session.refresh(order)
        self.assertEqual(order.notes.count('Cash please'),1)
        self.assertEqual(len(self.session.exec(select(models.ServiceRequest).where(models.ServiceRequest.tenant_id == self.tenant.id)).all()),1)

    def test_closed_table_cannot_enqueue(self):
        self.table.is_active=False;self.session.add(self.table);self.session.commit()
        self.assertEqual(self.call().status_code,403)
        self.assertEqual(self.session.exec(select(models.ServiceRequest).where(models.ServiceRequest.tenant_id == self.tenant.id)).all(),[])

    def test_public_status_contains_no_staff_or_customer_details(self):
        identifier = self.call(message='Private guest message').json()['request_id']
        response = self.client.get(f'/menu/{self.table.token}/service-requests')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{'id': identifier, 'kind': 'call_waiter', 'status': 'pending'}])

    def test_assignment_is_enforced_for_waiters(self):
        waiters = [models.User(email=uuid4().hex+'@amvara.de', hashed_password='unused', role=models.UserRole.waiter, tenant_id=self.tenant.id) for _ in range(2)]
        self.session.add_all(waiters); self.session.flush()
        self.table.assigned_waiter_id = waiters[0].id
        self.session.add(self.table); self.session.commit()
        identifier = self.call().json()['request_id']
        self.assertEqual(self.client.get('/service-requests', headers=self.headers_for(waiters[1])).json(), [])
        self.assertEqual(self.client.patch(f'/service-requests/{identifier}', json={'status': 'resolved'}, headers=self.headers_for(waiters[1])).status_code, 403)
        self.assertEqual(self.client.patch(f'/service-requests/{identifier}', json={'status': 'resolved'}, headers=self.headers_for(waiters[0])).status_code, 200)
