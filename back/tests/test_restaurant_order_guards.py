from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from sqlmodel import select
from pg_client_mixin import PgClientTestCase
from app import models, security


class TestRestaurantOrderGuards(PgClientTestCase):
    def setUp(self):
        super().setUp()
        self.tenant = models.Tenant(name='Isolated restaurant order checks', currency_code='TRY', timezone='Europe/Istanbul')
        self.session.add(self.tenant); self.session.flush()
        self.table = models.Table(tenant_id=self.tenant.id, name='Take Away', is_active=True)
        self.product = models.Product(tenant_id=self.tenant.id, name='Updated restaurant dish', price_cents=15000, category='Kahvaltı')
        self.owner = models.User(tenant_id=self.tenant.id, email=uuid4().hex+'@amvara.de', hashed_password='unused', role=models.UserRole.owner)
        self.session.add_all([self.table, self.product, self.owner]); self.session.commit()
        self.session.refresh(self.table); self.session.refresh(self.product); self.session.refresh(self.owner)

    def submit(self, product_id=None, source='product', quantity=1, key=None):
        return self.client.post(f'/menu/{self.table.token}/order', json={'idempotency_key':key, 'items':[{'product_id':product_id or self.product.id,'source':source,'quantity':quantity}]})

    def link_catalog(self, *, active=True):
        catalog = models.ProductCatalog(name='Original catalog dish',category='Desserts')
        self.session.add(catalog); self.session.flush()
        tp = models.TenantProduct(tenant_id=self.tenant.id,catalog_id=catalog.id,product_id=self.product.id,name='Outdated catalog name',price_cents=100,is_active=active,image_filename='old-image.png')
        self.session.add(tp); self.session.commit(); self.session.refresh(tp)
        return tp

    def test_invalid_quantities_are_rejected_before_creating_an_order(self):
        for quantity in (-3,0,100):
            self.assertEqual(self.submit(quantity=quantity).status_code,400)
        self.assertEqual(self.session.exec(select(models.Order).where(models.Order.tenant_id==self.tenant.id)).all(),[])

    def test_hidden_and_out_of_window_products_cannot_be_ordered_by_id(self):
        self.product.is_active=False;self.session.add(self.product);self.session.commit()
        self.assertEqual(self.submit().status_code,400)
        self.product.is_active=True;self.product.available_from=date.today()+timedelta(days=10)
        self.session.add(self.product);self.session.commit()
        self.assertEqual(self.submit().status_code,400)
        self.product.available_from=None;self.product.available_until=date.today()-timedelta(days=10)
        self.session.add(self.product);self.session.commit()
        self.assertEqual(self.submit().status_code,400)
        self.assertEqual(self.session.exec(select(models.Order).where(models.Order.tenant_id==self.tenant.id)).all(),[])

    def test_hidden_catalog_selection_cannot_be_reintroduced_through_legacy_mirror(self):
        tp=self.link_catalog(active=False)
        qr=self.client.get(f'/menu/{self.table.token}')
        self.assertEqual(qr.status_code,200)
        self.assertEqual(qr.json()['products'],[])
        self.assertEqual(self.submit(tp.id,'tenant_product').status_code,400)
        self.assertEqual(self.submit(self.product.id,'product').status_code,400)

    def test_linked_restaurant_fields_are_consistent_in_public_pos_qr_and_order(self):
        tp=self.link_catalog()
        self.product.image_filename='restaurant-authoritative-image.png'
        self.session.add(self.product);self.session.commit()
        from app.public_tenant_menu import _UPLOADS_DIR
        image=_UPLOADS_DIR/str(self.tenant.id)/'products'/self.product.image_filename
        image.parent.mkdir(parents=True,exist_ok=True);image.write_bytes(b'isolated image fixture')
        self.addCleanup(lambda:image.unlink(missing_ok=True))
        token=security.create_access_token({'sub':self.owner.email,'tenant_id':self.tenant.id,'token_version':self.owner.token_version})
        headers={'Authorization':'Bearer '+token}
        public=self.client.get(f'/public/tenants/{self.tenant.id}/menu').json()
        pos=self.client.get('/staff/pos-menu?sale_type=table',headers=headers).json()
        qr=self.client.get(f'/menu/{self.table.token}').json()
        for menu in (public,pos):
            row=next(row for category in menu['categories'] for row in category['products'])
            self.assertEqual((row['id'],row['source'],row['name'],row['price_cents'],row['category']),(tp.id,'tenant_product',self.product.name,15000,'Kahvaltı'))
            self.assertTrue(row['image_url'].endswith(self.product.image_filename))
        row=qr['products'][0]
        self.assertEqual((row['id'],row['_source'],row['name'],row['price_cents'],row['category']),(tp.id,'tenant_product',self.product.name,15000,'Kahvaltı'))
        self.assertEqual(row['image_filename'],self.product.image_filename)
        response=self.submit(tp.id,'tenant_product')
        self.assertEqual(response.status_code,200,response.text)
        item=self.session.exec(select(models.OrderItem).where(models.OrderItem.order_id==response.json()['order_id'])).one()
        self.assertEqual((item.product_name,item.price_cents),(self.product.name,15000))

    def test_linked_product_visibility_window_reaches_all_menus_and_order(self):
        tp=self.link_catalog()
        self.product.available_from=date.today()+timedelta(days=10)
        self.session.add(self.product);self.session.commit()
        self.assertEqual(self.client.get(f'/public/tenants/{self.tenant.id}/menu').json()['categories'],[])
        self.assertEqual(self.client.get(f'/menu/{self.table.token}').json()['products'],[])
        self.assertEqual(self.submit(tp.id,'tenant_product').status_code,400)

    def test_committed_order_retry_is_replayed_even_if_product_was_hidden_afterward(self):
        key=uuid4().hex
        first=self.submit(key=key)
        self.assertEqual(first.status_code,200,first.text)
        self.product.is_active=False;self.session.add(self.product);self.session.commit()
        retry=self.submit(key=key)
        self.assertEqual(retry.status_code,200,retry.text)
        self.assertTrue(retry.json()['duplicate'])
        self.assertEqual(retry.json()['order_id'],first.json()['order_id'])

    def test_ambiguous_source_is_rejected_instead_of_selecting_another_dish(self):
        collision_id=1_200_000_000+self.tenant.id
        self.product.id=collision_id;self.session.add(self.product);self.session.commit()
        catalog=models.ProductCatalog(name='Independent dessert',category='Desserts')
        self.session.add(catalog);self.session.flush()
        self.session.add(models.TenantProduct(id=collision_id,tenant_id=self.tenant.id,catalog_id=catalog.id,name='Independent dessert',price_cents=5000))
        self.session.commit()
        self.assertEqual(self.submit(collision_id,None).status_code,400)
        response=self.submit(collision_id,'product')
        self.assertEqual(response.status_code,200,response.text)
        item=self.session.exec(select(models.OrderItem).where(models.OrderItem.order_id==response.json()['order_id'])).one()
        self.assertEqual(item.product_name,self.product.name)
