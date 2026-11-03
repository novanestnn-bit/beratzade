"""Real concurrent sessions; explicitly restricted to the disposable browser-test DB."""
import os
from queue import Queue
from threading import Event, Thread, current_thread
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, event
from sqlmodel import Session, select
from app import models, order_payment_service
from app.db import engine


class TestRestaurantPaymentConcurrency(unittest.TestCase):
    def setUp(self):
        if os.environ.get('ISOLATED_CONCURRENCY_TEST') != '1' or engine.url.host != 'beratzade-readiness-db' or engine.url.database != 'beratzade_browser_readiness':
            self.skipTest('Requires explicit disposable-database concurrency test opt-in')
        with Session(engine) as session:
            tenant=models.Tenant(name='Isolated concurrent payment '+uuid4().hex)
            session.add(tenant);session.flush();self.tenant_id=tenant.id
            product=models.Product(tenant_id=tenant.id,name='Isolated payable dish',price_cents=1000)
            order=models.Order(tenant_id=tenant.id,order_channel=models.OrderChannel.quick_sale)
            session.add_all([product,order]);session.flush()
            self.product_id=product.id;self.order_id=order.id
            session.add(models.OrderItem(order_id=order.id,product_id=product.id,product_name=product.name,quantity=1,price_cents=1000))
            session.commit()

    def tearDown(self):
        if not hasattr(self,'tenant_id'):return
        with Session(engine) as session:
            session.exec(delete(models.OrderPayment).where(models.OrderPayment.order_id==self.order_id))
            session.exec(delete(models.OrderItem).where(models.OrderItem.order_id==self.order_id))
            session.exec(delete(models.Order).where(models.Order.id==self.order_id))
            session.exec(delete(models.Product).where(models.Product.id==self.product_id))
            session.exec(delete(models.Tenant).where(models.Tenant.id==self.tenant_id));session.commit()

    def race(self, same_key):
        key=uuid4().hex;blocked=Event();outcome=Queue();session=Session(engine)
        def statement_started(connection,cursor,statement,parameters,context,executemany):
            statement=statement.lower().replace('"','')
            if current_thread().name=='restaurant-payment-racer' and ('for update' in statement or 'insert into order_payment' in statement):blocked.set()
        def second_cashier():
            with Session(engine) as other:
                stale_order=other.get(models.Order,self.order_id)
                try:
                    row,recon=order_payment_service.record_payment(other,order=stale_order,amount_cents=700,payment_method='terminal',paid_by_user_id=None,idempotency_key=key if same_key else uuid4().hex)
                    outcome.put(('recorded',row.id,recon['amount_paid_cents']))
                except HTTPException as error:
                    outcome.put(('rejected',error.status_code))
                except Exception as error:
                    outcome.put(('unexpected',type(error).__name__))
        worker=Thread(target=second_cashier,name='restaurant-payment-racer',daemon=True)
        event.listen(engine,'before_cursor_execute',statement_started)
        try:
            order=session.exec(select(models.Order).where(models.Order.id==self.order_id).with_for_update()).one()
            worker.start();self.assertTrue(blocked.wait(10),'Second cashier reached the locking point')
            first,recon=order_payment_service.record_payment(session,order=order,amount_cents=700,payment_method='terminal',paid_by_user_id=None,idempotency_key=key)
            result=outcome.get(timeout=10)
            with Session(engine) as check:
                legs=check.exec(select(models.OrderPayment).where(models.OrderPayment.order_id==self.order_id)).all()
                self.assertEqual(len(legs),1)
                self.assertEqual(sum(row.amount_cents for row in legs),700)
            if same_key:self.assertEqual(result,('recorded',first.id,700))
            else:self.assertEqual(result,('rejected',400))
        finally:
            session.close();worker.join(timeout=10);event.remove(engine,'before_cursor_execute',statement_started)

    def test_two_different_terminal_keys_cannot_overpay_the_same_remaining_balance(self):
        self.race(same_key=False)

    def test_concurrent_replay_of_the_same_key_returns_the_original_payment(self):
        self.race(same_key=True)
