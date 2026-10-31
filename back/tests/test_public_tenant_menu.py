"""Tests for GET /public/tenants/{tenant_id}/menu (marketing websites)."""
from __future__ import annotations

import unittest
from datetime import date, timedelta

from pg_client_mixin import PgClientTestCase

from app import models, security
from app.public_tenant_menu import (
    assert_no_sensitive_product_fields,
    format_public_price,
    group_products_into_categories,
)


class TestPublicTenantMenu(PgClientTestCase):
    def setUp(self):
        super().setUp()
        self.tenant = models.Tenant(
            name="Marketing Menu Tenant",
            email="pos-public-menu-test@amvara.de",
            currency_code="EUR",
        )
        self.session.add(self.tenant)
        self.session.commit()
        self.session.refresh(self.tenant)

    def test_missing_tenant_returns_404(self):
        response = self.client.get("/public/tenants/999999/menu")
        self.assertEqual(response.status_code, 404, response.text)

    def test_empty_menu_returns_200_with_empty_categories(self):
        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["tenant_id"], self.tenant.id)
        self.assertEqual(data["tenant_name"], "Marketing Menu Tenant")
        self.assertEqual(data["currency"], "EUR")
        self.assertEqual(data["lang"], "en")
        self.assertEqual(data["categories"], [])

    def test_table_menu_excludes_inactive_legacy_products(self):
        table = models.Table(tenant_id=self.tenant.id, name="Visibility check", is_active=True)
        self.session.add(table)
        self.session.add(models.Product(tenant_id=self.tenant.id, name="Published product", price_cents=3000, is_active=True))
        self.session.add(models.Product(tenant_id=self.tenant.id, name="Unverified product", price_cents=3000, is_active=False))
        other_tenant = models.Tenant(name="Other tenant")
        self.session.add(other_tenant)
        self.session.flush()
        self.session.add(models.Product(tenant_id=other_tenant.id, name="Other tenant product", price_cents=3000, is_active=True))
        self.session.commit()
        self.session.refresh(table)

        response = self.client.get(f"/menu/{table.token}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([product["name"] for product in response.json()["products"]], ["Published product"])

    def test_owner_visibility_updates_reach_public_and_table_menus(self):
        owner = models.User(email="visibility-owner@amvara.de", hashed_password="unused", role=models.UserRole.owner, tenant_id=self.tenant.id)
        product = models.Product(name="Visibility lifecycle", tenant_id=self.tenant.id, price_cents=15000, is_active=True)
        table = models.Table(name="Visibility table", tenant_id=self.tenant.id, is_active=True)
        self.session.add_all([owner, product, table])
        self.session.commit()
        self.session.refresh(owner)
        self.session.refresh(product)
        self.session.refresh(table)
        token = security.create_access_token({"sub": owner.email, "tenant_id": owner.tenant_id, "provider_id": None, "token_version": owner.token_version})
        headers = {"Authorization": f"Bearer {token}"}
        for active in (False, True):
            response = self.client.put(f"/products/{product.id}", headers=headers, json={"is_active": active})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["is_active"], active)
            self.assertEqual(response.json()["price_cents"], 15000)
            menu = self.client.get(f"/public/tenants/{self.tenant.id}/menu").json()
            public_ids = [row["id"] for category in menu["categories"] for row in category["products"]]
            self.assertEqual(product.id in public_ids, active)
            qr_menu = self.client.get(f"/menu/{table.token}").json()
            self.assertEqual(product.id in [row["id"] for row in qr_menu["products"]], active)

    def test_custom_empty_categories_are_visible_in_public_menu(self):
        self.tenant.custom_subcategories = {
            "Kahvaltı": [],
            "Kebaplar ve Izgaralar": [],
        }
        self.session.add(self.tenant)
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu?lang=tr")
        self.assertEqual(response.status_code, 200, response.text)
        categories = response.json()["categories"]
        self.assertEqual(
            [item["name"] for item in categories],
            ["Kahvaltı", "Kebaplar ve Izgaralar"],
        )
        self.assertTrue(all(item["products"] == [] for item in categories))

    def test_category_tree_includes_empty_subcategories_and_keeps_products_separate(self):
        self.tenant.custom_subcategories = {
            "Kahvaltı": ["Fırın Ürünleri", "Menemenler"],
            "Kebaplar ve Izgaralar": ["Et", "Tavuk"],
        }
        self.session.add(self.tenant)
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="DEMO — Menemen",
                price_cents=16500,
                category="Kahvaltı",
                subcategory="Menemenler",
            )
        )
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="DEMO — Kahvaltı Tabağı",
                price_cents=28500,
                category="Kahvaltı",
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu?lang=tr")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        breakfast = next(item for item in data["category_tree"] if item["name"] == "Kahvaltı")
        bakery = next(item for item in breakfast["subcategories"] if item["name"] == "Fırın Ürünleri")
        menemen = next(item for item in breakfast["subcategories"] if item["name"] == "Menemenler")
        kebabs = next(item for item in data["category_tree"] if item["name"] == "Kebaplar ve Izgaralar")
        chicken = next(item for item in kebabs["subcategories"] if item["name"] == "Tavuk")

        self.assertEqual(bakery["products"], [])
        self.assertEqual([item["name"] for item in menemen["products"]], ["DEMO — Menemen"])
        self.assertEqual(chicken["products"], [])
        self.assertEqual([item["name"] for item in breakfast["products"]], ["DEMO — Kahvaltı Tabağı"])
        self.assertEqual(len(data["categories"]), 3, "the legacy flat menu response remains unchanged")
        self.assertEqual(
            {item["name"] for item in data["categories"]},
            {"Kahvaltı", "Menemenler", "Kebaplar ve Izgaralar"},
        )

    def test_happy_path_grouped_by_category(self):
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Olivas",
                price_cents=250,
                description="Aceitunas",
                category="Entrantes",
                cost_cents=100,
                ingredients="olives, salt",
            )
        )
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Paella",
                price_cents=1200,
                description="Arroz",
                category="Principales",
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()

        self.assertEqual(len(data["categories"]), 2)
        cat_ids = {c["id"] for c in data["categories"]}
        self.assertIn("starters", cat_ids)
        self.assertIn("principales", cat_ids)
        by_id = {c["id"]: c for c in data["categories"]}
        self.assertEqual(by_id["starters"]["name"], "Starters")

        all_products = [p for c in data["categories"] for p in c["products"]]
        self.assertEqual(len(all_products), 2)
        names = {p["name"] for p in all_products}
        self.assertEqual(names, {"Olivas", "Paella"})

        olivas = next(p for p in all_products if p["name"] == "Olivas")
        self.assertEqual(olivas["price_cents"], 250)
        self.assertEqual(olivas["price_formatted"], "2.50")
        self.assertEqual(olivas["description"], "Aceitunas")
        self.assertEqual(olivas["category"], "Entrantes")
        self.assertEqual(data["categories"][0]["name"], "Starters")
        self.assertIsNone(olivas["subcategory"])
        self.assertTrue(olivas["available"])

        for product in all_products:
            assert_no_sensitive_product_fields(product)
            self.assertNotIn("cost_cents", product)
            self.assertNotIn("ingredients", product)

    def test_lang_query_es_formats_price_with_comma(self):
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Tapa",
                price_cents=350,
                category="Entrantes",
            )
        )
        self.session.commit()

        response = self.client.get(
            f"/public/tenants/{self.tenant.id}/menu",
            params={"lang": "es"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["lang"], "es")
        product = data["categories"][0]["products"][0]
        self.assertEqual(product["price_formatted"], "3,50")
        self.assertEqual(data["categories"][0]["name"], "Entrantes")

    def test_group_by_subcategory_when_present(self):
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Margarita",
                price_cents=900,
                category="Main Course",
                subcategory="Carta principal",
            )
        )
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Calzone",
                price_cents=1390,
                category="Main Course",
                subcategory="Especialidades",
            )
        )
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Panna Cotta",
                price_cents=595,
                category="Desserts",
            )
        )
        self.session.commit()

        response = self.client.get(
            f"/public/tenants/{self.tenant.id}/menu",
            params={"lang": "es"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        names = [c["name"] for c in data["categories"]]
        self.assertEqual(
            names,
            ["Carta principal", "Especialidades", "Postres"],
        )
        panna = data["categories"][2]["products"][0]
        self.assertEqual(panna["name"], "Panna Cotta")
        self.assertIsNone(panna["subcategory"])

    def test_lang_from_accept_language_header(self):
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Item",
                price_cents=100,
                category="Snacks",
            )
        )
        self.session.commit()

        response = self.client.get(
            f"/public/tenants/{self.tenant.id}/menu",
            headers={"Accept-Language": "ca"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["lang"], "ca")

    def test_inactive_tenant_product_excluded(self):
        catalog = models.ProductCatalog(
            name="Catalog Beer",
            category="Bebidas",
            description="Cold beer",
        )
        self.session.add(catalog)
        self.session.commit()
        self.session.refresh(catalog)

        self.session.add(
            models.TenantProduct(
                tenant_id=self.tenant.id,
                catalog_id=catalog.id,
                name="Hidden Beer",
                price_cents=400,
                is_active=False,
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["categories"], [])

    def test_availability_window_excludes_future_product(self):
        tomorrow = date.today() + timedelta(days=1)
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="Future Special",
                price_cents=500,
                category="Specials",
                available_from=tomorrow,
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["categories"], [])

    def test_linked_legacy_product_not_duplicated(self):
        legacy = models.Product(
            tenant_id=self.tenant.id,
            name="Demo Burger",
            price_cents=900,
            description="Classic burger",
            category="Main Course",
        )
        self.session.add(legacy)
        self.session.commit()
        self.session.refresh(legacy)

        catalog = models.ProductCatalog(
            name="Demo Burger Catalog",
            category="Main Course",
            description="Classic burger",
        )
        self.session.add(catalog)
        self.session.commit()
        self.session.refresh(catalog)

        self.session.add(
            models.TenantProduct(
                tenant_id=self.tenant.id,
                catalog_id=catalog.id,
                product_id=legacy.id,
                name="Demo Burger",
                price_cents=900,
                is_active=True,
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        self.assertEqual(response.status_code, 200, response.text)
        all_products = [
            p for c in response.json()["categories"] for p in c["products"]
        ]
        self.assertEqual(len(all_products), 1)
        self.assertEqual(all_products[0]["name"], "Demo Burger")

    def test_product_image_url_omitted_when_file_missing(self):
        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="With Image",
                price_cents=500,
                category="Platos",
                image_filename="dish-missing.jpg",
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        product = response.json()["categories"][0]["products"][0]
        self.assertIsNone(product["image_url"])

    def test_product_image_url_for_tenant_upload_when_file_exists(self):
        from pathlib import Path

        from app.public_tenant_menu import _UPLOADS_DIR

        fn = "dish-exists.jpg"
        dest = _UPLOADS_DIR / str(self.tenant.id) / "products" / fn
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"fake-image")
        self.addCleanup(lambda: dest.unlink(missing_ok=True))

        self.session.add(
            models.Product(
                tenant_id=self.tenant.id,
                name="With Image",
                price_cents=500,
                category="Platos",
                image_filename=fn,
            )
        )
        self.session.commit()

        response = self.client.get(f"/public/tenants/{self.tenant.id}/menu")
        product = response.json()["categories"][0]["products"][0]
        self.assertEqual(
            product["image_url"],
            f"/uploads/{self.tenant.id}/products/{fn}",
        )


class TestGroupProductsIntoCategories(unittest.TestCase):
    def test_unit_grouping_prefers_subcategory(self):
        products = [
            {
                "name": "Sangría",
                "category": "Beverages",
                "subcategory": None,
            },
            {
                "name": "Margarita",
                "category": "Main Course",
                "subcategory": "Carta principal",
            },
        ]
        sections = group_products_into_categories(products, "es")
        self.assertEqual([s["name"] for s in sections], ["Carta principal", "Bebidas"])


class TestFormatPublicPrice(unittest.TestCase):
    def test_en_uses_dot(self):
        self.assertEqual(format_public_price(250, "en"), "2.50")

    def test_es_uses_comma(self):
        self.assertEqual(format_public_price(250, "es"), "2,50")

    def test_ca_uses_comma(self):
        self.assertEqual(format_public_price(1250, "ca"), "12,50")


if __name__ == "__main__":
    unittest.main()
