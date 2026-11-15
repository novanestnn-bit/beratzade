"""Idempotently add only the requested Beratzade beverage products."""

from __future__ import annotations

import os

from sqlmodel import Session, select

from app import models
from app.db import engine
from app.settings import settings
from app.seeds.seed_beratzade_menu import (
    CATEGORIES, MENU, TENANT_ID, TENANT_NAME, normalize_name, validate_seed_environment,
)

BEVERAGE_NAMES = {
    "Uludağ Limonata (Şişe 250 ml)",
    "Coca-Cola (330 ml)",
    "Pepsi (330 ml)",
    "Bardak Ayran",
    "Küçük Ayran",
    "Coca-Cola (1 L)",
    "Fanta (1 L)",
    "Doğanay Şalgam (Küçük)",
    "Ekşi Ayran",
    "Acılı Ayran",
    "Naneli Ayran",
    "Capri-Sun",
}
CATEGORY = next(
    category
    for category in CATEGORIES
    if normalize_name(category) == normalize_name("İçecek Çeşitleri")
)
BEVERAGES = tuple(
    (name, price_cents)
    for category, name, price_cents, _description in MENU
    if normalize_name(category) == normalize_name(CATEGORY)
    and normalize_name(name) in {normalize_name(value) for value in BEVERAGE_NAMES}
)
if len(BEVERAGES) != len(BEVERAGE_NAMES):
    raise RuntimeError("The approved beverage rows do not match the full menu seed.")

def run() -> tuple[int, int]:
    validate_seed_environment(
        production=settings.is_production,
        opt_in=os.environ.get("ALLOW_BERATZADE_MENU_IMPORT") == "1",
        production_opt_in=os.environ.get("ALLOW_BERATZADE_MENU_PRODUCTION_IMPORT") == "1",
        confirmed_tenant_id=(
            int(os.environ["BERATZADE_MENU_CONFIRM_TENANT_ID"])
            if os.environ.get("BERATZADE_MENU_CONFIRM_TENANT_ID", "").isdigit()
            else None
        ),
        database_host=engine.url.host,
        database_name=engine.url.database,
        tenant_ref=settings.local_dev_tenant_ref,
    )
    created = updated = 0
    with Session(engine) as session:
        tenant = session.get(models.Tenant, TENANT_ID)
        if tenant is None or normalize_name(tenant.name) != normalize_name(TENANT_NAME):
            raise RuntimeError(f"Expected Beratzade tenant {TENANT_ID}; refusing beverage import.")

        products = session.exec(
            select(models.Product).where(models.Product.tenant_id == tenant.id)
        ).all()
        by_name: dict[str, list[models.Product]] = {}
        for product in products:
            by_name.setdefault(normalize_name(product.name), []).append(product)

        for name, price_cents in BEVERAGES:
            matches = by_name.get(normalize_name(name), [])
            if len(matches) > 1:
                raise RuntimeError(f"Ambiguous Beratzade beverage product: {name!r}.")
            if matches:
                product = matches[0]
                product.name = name
                product.category = CATEGORY
                product.price_cents = price_cents
                product.is_active = True
                session.add(product)
                updated += 1
            else:
                product = models.Product(
                    tenant_id=tenant.id,
                    name=name,
                    category=CATEGORY,
                    subcategory=None,
                    price_cents=price_cents,
                    is_active=True,
                )
                session.add(product)
                by_name[normalize_name(name)] = [product]
                created += 1

        session.commit()
    return created, updated


if __name__ == "__main__":
    added, refreshed = run()
    print(f"Beratzade beverages: {added} added, {refreshed} updated.")
