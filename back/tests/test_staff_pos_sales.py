from datetime import timedelta
from uuid import uuid4

from pg_client_mixin import PgClientTestCase
from sqlmodel import select

from app import models, security


def _headers(user: models.User) -> dict[str, str]:
    token = security.create_access_token(
        {
            "sub": user.email,
            "tenant_id": user.tenant_id,
            "provider_id": None,
            "token_version": user.token_version,
        },
        expires_delta=timedelta(minutes=30),
    )
    return {"Authorization": f"Bearer {token}"}


class TestStaffPosSales(PgClientTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.tenant = models.Tenant(name="Staff POS Test", currency_code="TRY")
        self.session.add(self.tenant)
        self.session.commit()
        self.session.refresh(self.tenant)
        self.waiter = models.User(
            email=f"pos-waiter-{uuid4().hex[:8]}@test.local",
            hashed_password=security.get_password_hash("unused-test-password"),
            role=models.UserRole.waiter,
            tenant_id=self.tenant.id,
            full_name="POS Waiter",
        )
        self.product = models.Product(
            tenant_id=self.tenant.id,
            name="POS Test Soup",
            description="Test catalog item",
            category="Soups",
            price_cents=725,
            is_active=True,
        )
        self.session.add(self.waiter)
        self.session.add(self.product)
        self.session.commit()
        self.session.refresh(self.waiter)
        self.session.refresh(self.product)
        self.headers = _headers(self.waiter)

    def _create_sale(self, key: str, sale_type: str = "quick_sale", quantity: int = 2):
        return self.client.post(
            "/orders/staff-sale",
            headers=self.headers,
            json={
                "idempotency_key": key,
                "sale_type": sale_type,
                "items": [
                    {
                        "product_id": self.product.id,
                        "source": "product",
                        "quantity": quantity,
                        "notes": "Az acılı",
                    }
                ],
                "customer_name": "Test pickup customer" if sale_type == "takeaway" else None,
                "notes": "Paket servis tezgâhı",
            },
        )

    def test_quick_sale_is_a_real_order_and_idempotent(self) -> None:
        catalog = self.client.get("/staff/pos-menu?sale_type=quick_sale", headers=self.headers)
        self.assertEqual(catalog.status_code, 200, catalog.text)
        visible = [
            product
            for category in catalog.json()["category_tree"]
            for product in category["products"]
        ]
        self.assertTrue(any(row["id"] == self.product.id and row["source"] == "product" for row in visible))

        key = uuid4().hex
        created = self._create_sale(key)
        self.assertEqual(created.status_code, 200, created.text)
        order = created.json()
        self.assertEqual(order["order_channel"], "quick_sale")
        self.assertIsNone(order["table_id"])
        self.assertEqual(order["total_cents"], 1450)
        self.assertFalse(order["duplicate"])

        retry = self._create_sale(key)
        self.assertEqual(retry.status_code, 200, retry.text)
        self.assertEqual(retry.json()["id"], order["id"])
        self.assertTrue(retry.json()["duplicate"])
        self.assertEqual(len(self.session.exec(
            select(models.Order).where(models.Order.tenant_id == self.tenant.id)
        ).all()), 1)

        mismatch = self._create_sale(key, quantity=1)
        self.assertEqual(mismatch.status_code, 409, mismatch.text)

        listed = self.client.get("/orders", headers=self.headers)
        self.assertEqual(listed.status_code, 200, listed.text)
        row = next(item for item in listed.json() if item["id"] == order["id"])
        self.assertEqual(row["table_name"], "Hızlı Satış")
        self.assertEqual(row["staff_name"], self.waiter.full_name)
        self.assertEqual(row["items"][0]["product_name"], self.product.name)

    def test_takeaway_uses_shared_payment_ledger(self) -> None:
        created = self._create_sale(uuid4().hex, sale_type="takeaway")
        self.assertEqual(created.status_code, 200, created.text)
        order_id = created.json()["id"]
        self.assertEqual(created.json()["order_channel"], "takeaway")
        partial = self.client.post(
            f"/orders/{order_id}/payments",
            headers=self.headers,
            json={
                "amount_cents": 500,
                "payment_method": "cash",
                "idempotency_key": uuid4().hex,
            },
        )
        self.assertEqual(partial.status_code, 200, partial.text)
        self.assertEqual(partial.json()["amount_remaining_cents"], 950)
        self.assertEqual(partial.json()["status"], "partial")

        final = self.client.post(
            f"/orders/{order_id}/payments",
            headers=self.headers,
            json={
                "amount_cents": 950,
                "payment_method": "terminal",
                "idempotency_key": uuid4().hex,
            },
        )
        self.assertEqual(final.status_code, 200, final.text)
        self.assertEqual(final.json()["amount_remaining_cents"], 0)
        self.assertEqual(len(final.json()["payments"]), 2)
        self.assertIsNone(final.json()["payments"][0]["cash_register_session_id"])

        listed = self.client.get("/orders", headers=self.headers)
        row = next(item for item in listed.json() if item["id"] == order_id)
        self.assertEqual(row["payment_method"], "split")
        self.assertEqual([payment["payment_method"] for payment in row["payments"]], ["cash", "terminal"])

    def test_cash_register_reconciles_opening_movements_and_cash_payments(self) -> None:
        opened = self.client.post(
            "/cash-register/open",
            headers=self.headers,
            json={"opening_cash_cents": 5000},
        )
        self.assertEqual(opened.status_code, 200, opened.text)
        duplicate_open = self.client.post(
            "/cash-register/open",
            headers=self.headers,
            json={"opening_cash_cents": 0},
        )
        self.assertEqual(duplicate_open.status_code, 409, duplicate_open.text)

        for kind, amount, note in [("cash_in", 2000, "Bozuk para"), ("cash_out", 500, "Tedarikçi")]:
            movement = self.client.post(
                "/cash-register/movements",
                headers=self.headers,
                json={"movement_type": kind, "amount_cents": amount, "note": note},
            )
            self.assertEqual(movement.status_code, 200, movement.text)

        created = self._create_sale(uuid4().hex, quantity=1)
        paid = self.client.post(
            f"/orders/{created.json()['id']}/payments",
            headers=self.headers,
            json={"amount_cents": 725, "payment_method": "cash", "idempotency_key": uuid4().hex},
        )
        self.assertEqual(paid.status_code, 200, paid.text)
        register = self.client.get("/cash-register/current", headers=self.headers)
        self.assertEqual(register.status_code, 200, register.text)
        self.assertEqual(register.json()["expected_cash_cents"], 6500)

        closed = self.client.post(
            "/cash-register/close",
            headers=self.headers,
            json={"counted_cash_cents": 7200},
        )
        self.assertEqual(closed.status_code, 200, closed.text)
        self.assertEqual(closed.json()["expected_cash_cents"], 6500)
        self.assertEqual(closed.json()["variance_cents"], 700)
        self.assertEqual(self.client.get("/cash-register/current", headers=self.headers).json(), None)

        another = self._create_sale(uuid4().hex, quantity=1)
        cash_without_register = self.client.post(
            f"/orders/{another.json()['id']}/payments",
            headers=self.headers,
            json={"amount_cents": 725, "payment_method": "cash", "idempotency_key": uuid4().hex},
        )
        self.assertEqual(cash_without_register.status_code, 200, cash_without_register.text)
        self.assertEqual(cash_without_register.json()["status"], "paid")
        self.assertIsNone(cash_without_register.json()["payments"][0]["cash_register_session_id"])

    def test_cash_payment_is_recorded_without_opening_a_register(self) -> None:
        created = self._create_sale(uuid4().hex, quantity=1)
        payment = self.client.post(
            f"/orders/{created.json()['id']}/payments",
            headers=self.headers,
            json={"amount_cents": 725, "payment_method": "cash", "idempotency_key": uuid4().hex},
        )
        self.assertEqual(payment.status_code, 200, payment.text)
        self.assertEqual(payment.json()["status"], "paid")
        self.assertEqual(payment.json()["amount_paid_cents"], 725)
        self.assertIsNone(payment.json()["payments"][0]["cash_register_session_id"])

    def test_unavailable_products_are_rejected_and_staff_cannot_write_products(self) -> None:
        self.product.is_active = False
        self.session.add(self.product)
        self.session.commit()
        unavailable = self._create_sale(uuid4().hex)
        self.assertEqual(unavailable.status_code, 400, unavailable.text)

        blocked = self.client.post(
            "/products",
            headers=self.headers,
            json={"name": "Unauthorized", "price_cents": 1},
        )
        self.assertEqual(blocked.status_code, 403, blocked.text)

    def test_product_questions_are_shown_validated_and_snapshotted_on_staff_sale(self) -> None:
        question = models.ProductQuestion(
            tenant_id=self.tenant.id,
            product_id=self.product.id,
            type=models.ProductQuestionType.choice,
            label="Acılık",
            options=["Az", "Orta", "Acılı"],
            required=True,
        )
        self.session.add(question)
        self.session.commit()
        catalog = self.client.get("/staff/pos-menu?sale_type=quick_sale", headers=self.headers)
        self.assertEqual(catalog.status_code, 200, catalog.text)
        products = [
            item
            for category in catalog.json()["category_tree"]
            for item in category["products"]
        ]
        product_row = next(item for item in products if item["id"] == self.product.id)
        self.assertEqual(product_row["questions"][0]["label"], "Acılık")

        key = uuid4().hex
        missing_answer = self.client.post(
            "/orders/staff-sale",
            headers=self.headers,
            json={
                "idempotency_key": key,
                "sale_type": "quick_sale",
                "items": [{"product_id": self.product.id, "source": "product", "quantity": 1}],
            },
        )
        self.assertEqual(missing_answer.status_code, 422, missing_answer.text)

        created = self.client.post(
            "/orders/staff-sale",
            headers=self.headers,
            json={
                "idempotency_key": uuid4().hex,
                "sale_type": "quick_sale",
                "items": [{
                    "product_id": self.product.id,
                    "source": "product",
                    "quantity": 1,
                    "customization_answers": {str(question.id): "Orta"},
                }],
            },
        )
        self.assertEqual(created.status_code, 200, created.text)
        row = self.session.exec(
            select(models.OrderItem).where(models.OrderItem.order_id == created.json()["id"])
        ).one()
        self.assertEqual(row.customization_answers, {str(question.id): "Orta"})
        self.assertEqual(row.customization_summary, "Acılık: Orta")
