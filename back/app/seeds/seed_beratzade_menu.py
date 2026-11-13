"""Idempotently import the approved Beratzade menu into its tenant Product catalog.

This command is deliberately opt-in and refuses production. It never deletes
products, alters scheduled availability, or touches other tenants. It activates
approved menu products, applies their reviewed static photo map, and inactivates
only known duplicate or non-sellable legacy headings while preserving history.
"""

from __future__ import annotations

import os
import re
import unicodedata

from sqlmodel import Session, select

from app import models
from app.db import engine
from app.settings import settings
from app.tenant_subcategories import add_custom_category
from app.seeds.beratzade_menu_images import menu_image_filename


TENANT_NAME = "Beratzade Kebap & Kahvaltı Salonu"
TENANT_ID = 89
MENU = [
    # Category, name, price in kuruş, description
    ("Börekler & Hamur İşleri", "Sigara Böreği (Adet)", 2500, None),
    ("Börekler & Hamur İşleri", "Muska Böreği (Adet)", 3000, None),
    ("Börekler & Hamur İşleri", "Avcı Böreği (Adet)", 8000, None),
    ("Börekler & Hamur İşleri", "Gözleme", 17500, None),
    ("Börekler & Hamur İşleri", "Pankek", 10000, None),
    ("Börekler & Hamur İşleri", "Krep", 10000, None),
    ("Börekler & Hamur İşleri", "Poğaça", 3000, None),
    ("Börekler & Hamur İşleri", "Simit", 4000, None),
    ("Börekler & Hamur İşleri", "Açma", 4000, None),
    ("Tost Çeşitleri", "Kaşarlı Tost", 15000, "Yarım ekmek ile hazırlanır."),
    ("Tost Çeşitleri", "Sucuklu Tost", 15000, "Yarım ekmek ile hazırlanır."),
    ("Tost Çeşitleri", "Kavurmalı Tost", 20000, "Yarım ekmek ile hazırlanır."),
    ("Tost Çeşitleri", "Hellimli Tost", 15000, "Yarım ekmek ile hazırlanır."),
    ("Tost Çeşitleri", "Sucuklu Kaşarlı Tost", 20000, "Yarım ekmek ile hazırlanır."),
    ("Tost Çeşitleri", "Sucuklu Kavurmalı Kaşarlı Tost", 30000, "Yarım ekmek ile hazırlanır."),
    ("Beratzade Sandviç Menüsü", "Normal Sandviç", 10000, "Kendi sandviçini oluştur. 1 çeşit 100 TL; 2 çeşit 130 TL; sonraki her çeşit +30 TL. Kavurma +80 TL, eski kaşar +40 TL."),
    ("Beratzade Sandviç Menüsü", "Çeyrek Sandviç", 8000, "Kendi sandviçini oluştur. 1 çeşit 80 TL; 2 çeşit 95 TL; sonraki her çeşit +15 TL. Kavurma +40 TL, eski kaşar +20 TL."),
    ("Menemen Çeşitleri", "Sade Menemen", 20000, None),
    ("Menemen Çeşitleri", "Kaşarlı Menemen", 25000, None),
    ("Menemen Çeşitleri", "Sucuklu Menemen", 25000, None),
    ("Menemen Çeşitleri", "Karışık Menemen", 30000, None),
    ("Omlet & Sahanda Yumurta", "Sade Omlet", 20000, None),
    ("Omlet & Sahanda Yumurta", "Kaşarlı Omlet", 22500, None),
    ("Omlet & Sahanda Yumurta", "Sucuklu Omlet", 22500, None),
    ("Omlet & Sahanda Yumurta", "Kavurmalı Omlet", 27500, None),
    ("Omlet & Sahanda Yumurta", "Karışık Omlet", 35000, None),
    ("Omlet & Sahanda Yumurta", "Sahanda Göz Yumurta", 20000, None),
    ("Kahvaltı Tabağı", "Kahvaltı Tabağı", 45000, "Beyaz peynir, çeçil peyniri, kaşar peyniri, salatalık, domates, zeytin, bal, kaymak, haşlanmış yumurta, salam ve hindi füme."),
    ("Serpme Kahvaltı", "Serpme Kahvaltı (Minimum 2 Kişilik)", 140000, "Kahvaltılıklar, 2 çeşit ara sıcak ve kişi başı 1 menemen veya omlet seçimi dahildir."),
    ("Izgara & Kebap Çeşitleri", "Adana Dürüm", 30000, None),
    ("Izgara & Kebap Çeşitleri", "Urfa Dürüm", 30000, None),
    ("Izgara & Kebap Çeşitleri", "Ciğer Dürüm", 28000, None),
    ("Izgara & Kebap Çeşitleri", "Et Dürüm", 37500, None),
    ("Izgara & Kebap Çeşitleri", "Köfte Ekmek", 25000, None),
    ("Izgara & Kebap Çeşitleri", "Adana Kebap Servis", 45000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Urfa Kebap Servis", 45000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Et Şiş Servis", 45000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Tavuk Şiş Servis", 30000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Tavuk Kanat Servis", 35000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Tavuk Pirzola Servis", 35000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Köfte Servis", 40000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Izgara & Kebap Çeşitleri", "Ciğer Servis", 40000, "Közlenmiş domates, közlenmiş biber, sumaklı soğan, lavaş, bulgur pilavı ve ezme eşliğinde servis edilir."),
    ("Pilav", "Tavuklu Pilav", 22000, None),
    ("Dürüm Çeşitleri", "Tavuk Fajita Dürüm", 25000, None),
    ("Dürüm Çeşitleri", "Kavurmalı Kaşarlı Dürüm", 40000, None),
    ("Aperatifler & Ara Sıcaklar", "Çıtır Tavuk", 20000, None),
    ("Aperatifler & Ara Sıcaklar", "Viyana Usulü Tavuk Şnitzel", 28000, None),
    ("Aperatifler & Ara Sıcaklar", "Çıtır Peynir Çubukları", 12500, None),
    ("Aperatifler & Ara Sıcaklar", "Soğan Halkası", 10000, None),
    ("Aperatifler & Ara Sıcaklar", "Patates Kroket", 10000, None),
    ("Hamburger", "Hamburger", 32500, None),
    ("Tatlılar", "Fırın Sütlaç", 15000, None),
    ("İçecek Çeşitleri", "Taze Sıkılmış Portakal Suyu", 15000, None),
    ("İçecek Çeşitleri", "Küçük Çay", 2500, None),
    ("İçecek Çeşitleri", "Büyük Çay", 4000, None),
    ("İçecek Çeşitleri", "Nescafe", 4000, None),
    ("İçecek Çeşitleri", "Oralet Çeşitleri", 3000, None),
]

CATEGORIES = [
    "Börekler & Hamur İşleri", "Tost Çeşitleri", "Beratzade Sandviç Menüsü",
    "Menemen Çeşitleri", "Omlet & Sahanda Yumurta", "Kahvaltı Tabağı",
    "Serpme Kahvaltı", "Izgara & Kebap Çeşitleri", "Pilav", "Dürüm Çeşitleri",
    "Aperatifler & Ara Sıcaklar", "Hamburger", "Günlük Sulu Yemekler",
    "Tatlılar", "İçecek Çeşitleri", "Çorba Çeşitleri",
]


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _menu_product_id_map() -> dict[str, int]:
    """Known menu rows whose established identity takes precedence over name matching."""
    return {
        normalize_name("Urfa Kebap Servis"): 613,
        normalize_name("Fırın Sütlaç"): 621,
    }


def _deactivate_known_legacy_rows(session: Session, tenant_id: int) -> int:
    """Preserve history while removing the known duplicate and headings from sale."""
    expected = {
        612: normalize_name("Urfa Kebap Servis"),
        604: normalize_name("günlük taze çorba"),
        620: normalize_name("Günlük Sulu Yemekler"),
    }
    changed = 0
    for product_id, expected_name in expected.items():
        product = session.get(models.Product, product_id)
        if product is None or product.tenant_id != tenant_id:
            continue
        if normalize_name(product.name) != expected_name:
            raise RuntimeError(
                f"Refusing to change tenant {tenant_id} product {product_id}: "
                "its name does not match the approved legacy mapping."
            )
        if product.is_active:
            product.is_active = False
            session.add(product)
            changed += 1
    return changed


def validate_seed_environment(
    *,
    production: bool,
    opt_in: bool,
    production_opt_in: bool = False,
    confirmed_tenant_id: int | None = None,
    database_host: str | None,
    database_name: str | None,
    tenant_ref: str,
) -> None:
    if production:
        if not production_opt_in or confirmed_tenant_id != TENANT_ID:
            raise RuntimeError(
                "production import requires ALLOW_BERATZADE_MENU_PRODUCTION_IMPORT=1 "
                "and BERATZADE_MENU_CONFIRM_TENANT_ID=89."
            )
        if not database_host or not database_name:
            raise RuntimeError("Refusing production import without a configured database target.")
        return
    if not opt_in:
        raise RuntimeError("Set ALLOW_BERATZADE_MENU_IMPORT=1 to explicitly run this local import.")
    if database_host != "db" or database_name != "pos":
        raise RuntimeError("Refusing import: expected the local Docker pos database.")
    if normalize_name(tenant_ref) != normalize_name("beratzade-kebap-kahvalti-salonu"):
        raise RuntimeError("LOCAL_DEV_TENANT_REF must identify the Beratzade public slug.")


def run() -> None:
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
    with Session(engine) as session:
        tenant = session.get(models.Tenant, TENANT_ID)
        if tenant is None or normalize_name(tenant.name) != normalize_name(TENANT_NAME):
            raise RuntimeError(
                f"Expected tenant {TENANT_ID} to be the Beratzade restaurant; refusing import."
            )
        for category in CATEGORIES:
            add_custom_category(session, tenant.id, category)

        products = session.exec(
            select(models.Product).where(models.Product.tenant_id == tenant.id)
        ).all()
        by_name: dict[str, list[models.Product]] = {}
        for product in products:
            by_name.setdefault(normalize_name(product.name), []).append(product)

        menu_names = {normalize_name(name) for _, name, _, _ in MENU}
        product_id_map = _menu_product_id_map()
        for menu_product in session.exec(
            select(models.TenantProduct).where(models.TenantProduct.tenant_id == tenant.id)
        ).all():
            key = normalize_name(menu_product.name)
            if key not in menu_names:
                continue
            if menu_product.product_id is None:
                raise RuntimeError(
                    f"Menu import stopped: existing menu item {menu_product.name!r} has no linked Product row."
                )
            linked_product = session.get(models.Product, menu_product.product_id)
            if linked_product is None or linked_product.tenant_id != tenant.id:
                raise RuntimeError(
                    f"Menu import stopped: existing menu item {menu_product.name!r} has an invalid Product link."
                )
            key_products = by_name.setdefault(key, [])
            if not any(product.id == linked_product.id for product in key_products):
                key_products.append(linked_product)

        created = updated = 0
        for category, name, price_cents, description in MENU:
            key = normalize_name(name)
            preferred_id = product_id_map.get(key)
            if preferred_id is not None:
                preferred = session.get(models.Product, preferred_id)
                if preferred is None or preferred.tenant_id != tenant.id:
                    raise RuntimeError(
                        f"Expected approved product ID {preferred_id} for {name!r} in tenant {tenant.id}."
                    )
                matches = [preferred]
            else:
                matches = by_name.get(key, [])
            if len(matches) > 1:
                raise RuntimeError(
                    f"Ambiguous product mapping for {name!r}: "
                    f"{', '.join(str(product.id) for product in matches)}."
                )
            if matches:
                product = matches[0]
                # Keep identity, stock and scheduled availability; the approved
                # photo manifest is authoritative for the Beratzade menu assets.
                product.name = name
                product.category = category
                product.price_cents = price_cents
                product.description = description
                product.image_filename = menu_image_filename(name)
                product.is_active = True
                session.add(product)
                updated += 1
            else:
                product = models.Product(
                    tenant_id=tenant.id,
                    name=name,
                    category=category,
                    price_cents=price_cents,
                    description=description,
                    image_filename=menu_image_filename(name),
                    is_active=True,
                )
                session.add(product)
                by_name[key] = [product]
                created += 1

        session.flush()
        fillings = [
            "Kaşar", "Hindi salam", "Macar salam", "Eski kaşar", "Çeçil peyniri",
            "Zeytin salatası", "Yeşil biber", "Yumurta", "Beyaz peynir",
            "Salatalık", "Domates", "Patates kızartması", "Kavurma",
        ]
        for product_name, second_delta, extra_delta, kavurma_delta, eski_kasar_delta in (
            ("Normal Sandviç", 3000, 3000, 8000, 4000),
            ("Çeyrek Sandviç", 1500, 1500, 4000, 2000),
        ):
            product = by_name[normalize_name(product_name)][0]
            question = session.exec(
                select(models.ProductQuestion).where(
                    models.ProductQuestion.tenant_id == tenant.id,
                    models.ProductQuestion.product_id == product.id,
                    models.ProductQuestion.label == "Sandviç malzemeleri",
                )
            ).first()
            options = {
                "choices": fillings,
                "multi": True,
                "pricing": {
                    "type": "item_count",
                    "included": 1,
                    "second_item_delta_cents": second_delta,
                    "additional_item_delta_cents": extra_delta,
                    "choice_surcharges_cents": {
                        "Kavurma": kavurma_delta,
                        "Eski kaşar": eski_kasar_delta,
                    },
                },
            }
            if question is None:
                session.add(models.ProductQuestion(
                    tenant_id=tenant.id,
                    product_id=product.id,
                    type=models.ProductQuestionType.choice,
                    label="Sandviç malzemeleri",
                    options=options,
                    sort_order=0,
                    required=True,
                ))
            else:
                question.type = models.ProductQuestionType.choice
                question.options = options
                question.required = True
                session.add(question)

        serpme = by_name[normalize_name("Serpme Kahvaltı (Minimum 2 Kişilik)")][0]
        serpme_questions = [
            (
                "Kişi sayısı",
                {"min": 2, "max": 99},
                0,
            ),
            (
                "Ara sıcak seçimi (2 çeşit dahildir)",
                {
                    "choices": ["Kızarmış Hellim Peyniri", "Sigara Böreği"],
                    "multi": True,
                    "min_choices": 2,
                    "max_choices": 2,
                },
                1,
            ),
            (
                "Kişi başı ana sıcak seçimi",
                {
                    "choices": [
                        "Sade Menemen", "Kaşarlı Menemen", "Sucuklu Menemen", "Karışık Menemen",
                        "Sade Omlet", "Kaşarlı Omlet", "Sucuklu Omlet", "Karışık Omlet",
                    ],
                    "multi": True,
                    "per_person": True,
                    "selection_count_question_label": "Kişi sayısı",
                },
                2,
            ),
        ]
        for label, options, sort_order in serpme_questions:
            question = session.exec(
                select(models.ProductQuestion).where(
                    models.ProductQuestion.tenant_id == tenant.id,
                    models.ProductQuestion.product_id == serpme.id,
                    models.ProductQuestion.label == label,
                )
            ).first()
            if question is None:
                session.add(models.ProductQuestion(
                    tenant_id=tenant.id,
                    product_id=serpme.id,
                    type=(
                        models.ProductQuestionType.scale
                        if label == "Kişi sayısı"
                        else models.ProductQuestionType.choice
                    ),
                    label=label,
                    options=options,
                    sort_order=sort_order,
                    required=True,
                ))
            else:
                question.type = (
                    models.ProductQuestionType.scale
                    if label == "Kişi sayısı"
                    else models.ProductQuestionType.choice
                )
                question.options = options
                question.sort_order = sort_order
                question.required = True
                session.add(question)
        deactivated = _deactivate_known_legacy_rows(session, tenant.id)
        session.commit()
        print(
            f"Beratzade menu import: tenant={tenant.id}, created={created}, "
            f"updated={updated}, deactivated_legacy={deactivated}, listed_items={len(MENU)}"
        )


if __name__ == "__main__":
    run()
