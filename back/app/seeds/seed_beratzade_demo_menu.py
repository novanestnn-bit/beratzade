"""Create an explicitly labeled, local demo menu for Beratzade.

This seed only targets the uniquely named Beratzade tenant, creates missing
categories/products, and never changes or deletes existing menu entries.
Run from the local backend container with:
  docker exec pos-back python -m app.seeds.seed_beratzade_demo_menu
"""

import os

from sqlmodel import Session, select

from app import models
from app.db import engine
from app.settings import settings
from app.tenant_public_slug import allocate_unique_slug
from app.tenant_subcategories import add_custom_category, add_custom_subcategory


TENANT_NAME = "Beratzade Kebap & Kahvaltı Salonu"
PUBLIC_SLUG = "beratzade-kebap-kahvalti-salonu"
CATEGORIES = [
    "Kahvaltı",
    "Kebaplar ve Izgaralar",
    "Günün Çorbaları",
    "Günün Yemekleri",
    "Et Yemekleri",
    "Tavuk Yemekleri",
    "Mezeler ve Salatalar",
    "Yan Ürünler",
    "Tatlılar",
    "İçecekler",
]

# name, category, example price in kuruş, demo-only description
DEMO_PRODUCTS = [
    ("DEMO — Kahvaltı Tabağı", "Kahvaltı", 28500, "Yalnızca yerel tasarım demosu; gerçek menü ürünü veya fiyatı değildir."),
    ("DEMO — Menemen", "Kahvaltı", 16500, "Yalnızca yerel tasarım demosu; gerçek menü ürünü veya fiyatı değildir."),
    ("DEMO — Adana Kebap", "Kebaplar ve Izgaralar", 32000, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Izgara Köfte", "Kebaplar ve Izgaralar", 29500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Mercimek Çorbası", "Günün Çorbaları", 9000, "Yalnızca yerel tasarım demosu; gerçek menü ürünü veya fiyatı değildir."),
    ("DEMO — Günün Yemeği", "Günün Yemekleri", 18000, "Yalnızca yerel tasarım demosu; gerçek menü ürünü veya fiyatı değildir."),
    ("DEMO — Et Sote", "Et Yemekleri", 34000, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Kuzu Güveç", "Et Yemekleri", 36500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Izgara Tavuk", "Tavuk Yemekleri", 26500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Tavuk Şiş", "Tavuk Yemekleri", 27500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Meze Tabağı", "Mezeler ve Salatalar", 18500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Mevsim Salata", "Mezeler ve Salatalar", 12500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Pilav", "Yan Ürünler", 8500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Lavaş", "Yan Ürünler", 4500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Sütlaç", "Tatlılar", 11000, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Künefe", "Tatlılar", 17500, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Ayran", "İçecekler", 4000, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
    ("DEMO — Türk Kahvesi", "İçecekler", 7000, "Örnek içerik ve fiyat. Gerçek restoran menüsünü yansıtmaz."),
]

SUBCATEGORIES = {
    "Kahvaltı": ["Fırın Ürünleri", "Sandviçler", "Menemenler", "Yumurta Çeşitleri"],
    "Kebaplar ve Izgaralar": ["Et", "Tavuk"],
    "Mezeler ve Salatalar": ["Meze", "Salata"],
    "İçecekler": ["Sıcak", "Soğuk"],
}

# Explicit assignments for these labeled local demo records only. Existing
# restaurant products are never classified or moved by this seed.
DEMO_SUBCATEGORY_ASSIGNMENTS = {
    "DEMO — Menemen": ("Kahvaltı", "Menemenler"),
    "DEMO — Adana Kebap": ("Kebaplar ve Izgaralar", "Et"),
    "DEMO — Izgara Köfte": ("Kebaplar ve Izgaralar", "Et"),
    "DEMO — Meze Tabağı": ("Mezeler ve Salatalar", "Meze"),
    "DEMO — Mevsim Salata": ("Mezeler ve Salatalar", "Salata"),
    "DEMO — Türk Kahvesi": ("İçecekler", "Sıcak"),
    "DEMO — Ayran": ("İçecekler", "Soğuk"),
}


def validate_seed_environment(*, production: bool, explicit_opt_in: bool, database_host: str | None, database_name: str | None, tenant_ref: str) -> None:
    """Fail closed unless explicitly opted in for the local Beratzade tenant."""
    if production:
        raise RuntimeError("Refusing to seed Beratzade demo data in production.")
    if not explicit_opt_in:
        raise RuntimeError("Set ALLOW_BERATZADE_DEMO_SEED=1 for an explicit local demo seed run.")
    if database_host != "db" or database_name != "pos":
        raise RuntimeError("Refusing to seed: backend is not connected to the expected local pos database service.")
    if (tenant_ref or "").strip() != PUBLIC_SLUG:
        raise RuntimeError("Set LOCAL_DEV_TENANT_REF to the Beratzade public slug before seeding.")


def run() -> None:
    # This command must never write to production or an unapproved local database.
    validate_seed_environment(
        production=settings.is_production,
        explicit_opt_in=os.environ.get("ALLOW_BERATZADE_DEMO_SEED") == "1",
        database_host=engine.url.host,
        database_name=engine.url.database,
        tenant_ref=settings.local_dev_tenant_ref,
    )

    with Session(engine) as session:
        tenants = session.exec(select(models.Tenant)).all()
        def normalized_brand(value: str | None) -> str:
            return " ".join((value or "").strip().casefold().replace("kebab", "kebap").split())

        matches = [tenant for tenant in tenants if normalized_brand(tenant.name) == normalized_brand(TENANT_NAME)]
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one Beratzade tenant; found {len(matches)}.")
        tenant = matches[0]
        tenant.name = TENANT_NAME
        tenant.currency_code = "TRY"
        tenant.currency = "₺"
        tenant.default_language = "tr"
        tenant.timezone = "Europe/Istanbul"
        if tenant.public_slug != PUBLIC_SLUG:
            tenant.public_slug = allocate_unique_slug(
                session, PUBLIC_SLUG, exclude_tenant_id=tenant.id
            )
        slug = tenant.public_slug
        session.add(tenant)
        session.commit()

        for category in CATEGORIES:
            add_custom_category(session, tenant.id, category)
        for category, subcategories in SUBCATEGORIES.items():
            for subcategory in subcategories:
                add_custom_subcategory(session, tenant.id, category, subcategory)

        existing = set(
            session.exec(select(models.Product.name).where(models.Product.tenant_id == tenant.id)).all()
        )
        created = 0
        for name, category, price_cents, description in DEMO_PRODUCTS:
            if name in existing:
                continue
            session.add(
                models.Product(
                    tenant_id=tenant.id,
                    name=name,
                    category=category,
                    price_cents=price_cents,
                    description=description,
                    image_filename=None,
                    is_active=True,
                )
            )
            created += 1
        session.commit()

        for name, (category, subcategory) in DEMO_SUBCATEGORY_ASSIGNMENTS.items():
            product = session.exec(
                select(models.Product).where(
                    models.Product.tenant_id == tenant.id,
                    models.Product.name == name,
                )
            ).first()
            if product is None:
                raise RuntimeError(f"Expected local demo product was not found: {name}")
            if product.category != category:
                raise RuntimeError(f"Refusing to change category for local demo product: {name}")
            if product.subcategory is None:
                product.subcategory = subcategory
                session.add(product)
            elif product.subcategory != subcategory:
                raise RuntimeError(f"Refusing to overwrite an existing subcategory for: {name}")
        session.commit()
        print(f"Local demo menu ready: tenant={tenant.id}, slug={slug}, created_products={created}")


if __name__ == "__main__":
    run()
