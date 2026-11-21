"""Exercise the drink import against an isolated SQLite database."""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlmodel import Session, create_engine, select

from app import models
from app.seeds.seed_beratzade_drinks import DRINKS, DRAFT_DRINKS, PUBLIC_SLUG, seed


@compiles(JSONB, "sqlite")
def compile_jsonb(element, compiler, **kwargs):
    return "JSON"


class DrinkSeedTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        models.Tenant.__table__.create(self.engine)
        models.Product.__table__.create(self.engine)
        self.session = Session(self.engine)
        self.uploads = TemporaryDirectory()

    def seed(self):
        return seed(self.session, uploads_dir=Path(self.uploads.name))

    def tearDown(self):
        self.session.close()
        self.engine.dispose()
        self.uploads.cleanup()

    def test_import_is_complete_repeatable_and_tenant_scoped(self):
        target = models.Tenant(name="Beratzade", public_slug=PUBLIC_SLUG, currency_code="TRY")
        other = models.Tenant(name="Other")
        self.session.add_all([target, other])
        self.session.commit()
        self.session.add(models.Product(
            tenant_id=other.id, name=DRINKS[0][0], price_cents=1234,
        ))
        self.session.commit()
        self.assertEqual(self.seed(), 39)
        products = self.session.exec(select(models.Product).where(
            models.Product.tenant_id == target.id,
        )).all()
        self.assertEqual(len(products), 39)
        self.assertEqual(sum(p.is_active for p in products), 30)
        self.assertTrue(all(not p.is_active for p in products if p.price_cents == 0))
        illustrated = [p for p in products if p.image_filename]
        self.assertEqual(len(illustrated), 35)
        for product in illustrated:
            self.assertTrue((Path(self.uploads.name) / str(target.id) / "products" / product.image_filename).is_file())
        self.assertEqual({p.name: p.price_cents for p in products}, {
            name: price for name, price, _ in (*DRINKS, *DRAFT_DRINKS)
        })
        self.assertTrue(all(p.category == "İçecekler" and p.subcategory == "Soğuk" for p in products))
        products[0].price_cents = 9999
        products[0].image_filename = "existing.webp"
        self.session.add(products[0])
        self.session.commit()
        self.assertEqual(self.seed(), 0)
        self.session.refresh(products[0])
        self.assertEqual(products[0].price_cents, 9999)
        self.assertEqual(products[0].image_filename, "existing.webp")
        other_product = self.session.exec(select(models.Product).where(
            models.Product.tenant_id == other.id,
        )).one()
        self.assertEqual(other_product.price_cents, 1234)

    def test_missing_tenant_and_wrong_currency_do_not_write_products(self):
        with self.assertRaises(RuntimeError):
            seed(self.session)
        self.session.add(models.Tenant(name="Beratzade", public_slug=PUBLIC_SLUG, currency_code="EUR"))
        self.session.commit()
        with self.assertRaises(RuntimeError):
            seed(self.session)
        self.assertEqual(self.session.exec(select(models.Product)).all(), [])

    def test_static_images_are_available_for_deployment(self):
        self.session.add(models.Tenant(name="Beratzade", public_slug=PUBLIC_SLUG, currency_code="TRY"))
        self.session.commit()
        self.assertEqual(seed(self.session, static_images=True), 39)
        products = self.session.exec(select(models.Product)).all()
        illustrated = [p for p in products if p.image_filename]
        self.assertEqual(len(illustrated), 35)
        self.assertTrue(all(p.image_filename.startswith("menu-images/beratzade/drinks/") for p in illustrated))
