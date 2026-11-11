"""Public tenant menu for marketing websites (GET /public/tenants/{tenant_id}/menu)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from . import models
from .menu_product_rules import is_beratzade_demo_product, is_non_sellable_menu_heading
from . import promo_service as promo_svc
from .category_codes import get_public_category_display_label
from .tenant_currency import normalize_tenant_currency_fields
from .tenant_subcategories import STANDARD_CATEGORY_ORDER, normalize_custom_subcategories
from .translation_service import TranslationService

_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"

_UNCategorized_CATEGORY = "Other"
_UNCategorized_SLUG = "other"

_SENSITIVE_PRODUCT_KEYS = frozenset(
    {
        "cost_cents",
        "ingredients",
        "tax_id",
        "kitchen_station_id",
        "tenant_id",
        "_source",
        "questions",
        "wine_type",
        "category_code",
        "subcategory_codes",
        "display_name",
        "display_ingredients",
        "display_description",
        "detailed_description",
        "country",
        "region",
        "wine_style",
        "vintage",
        "winery",
        "grape_variety",
        "aromas",
        "elaboration",
        "image_filename",
    }
)


def format_public_price(price_cents: int, lang: str = "en") -> str:
    """Format cents as a decimal string (e.g. 250 -> '2,50' for es/ca)."""
    amount = price_cents / 100
    formatted = f"{amount:.2f}"
    if lang.startswith(("es", "ca")):
        return formatted.replace(".", ",")
    return formatted


def resolve_product_image_url(tenant_id: int, image_filename: str | None) -> str | None:
    """Return /uploads/... URL only when the image file exists on disk (else None / placeholder)."""
    if not image_filename:
        return None
    fn = image_filename.replace("\\", "/").strip("/")
    if not fn or fn.startswith(".") or ".." in fn.split("/"):
        return None
    if fn.startswith("providers/"):
        path = _UPLOADS_DIR / fn
        if not path.is_file():
            return None
        return f"/uploads/{fn}"
    # Tenant product image: basename only under uploads/{tenant_id}/products/
    if "/" in fn or fn.startswith("."):
        return None
    path = _UPLOADS_DIR / str(tenant_id) / "products" / fn
    if not path.is_file():
        return None
    return f"/uploads/{tenant_id}/products/{fn}"


def _category_slug(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or _UNCategorized_SLUG


def _is_available_today(
    available_from,
    available_until,
    today,
) -> bool:
    if available_from is not None and available_from > today:
        return False
    if available_until is not None and available_until < today:
        return False
    return True


def _tenant_today(tenant: models.Tenant | None):
    try:
        tz = ZoneInfo(tenant.timezone) if tenant and tenant.timezone else timezone.utc
    except Exception:
        tz = timezone.utc
    return datetime.now(tz).date()


def _resolve_tenant_product_image(
    session: Session,
    tenant_id: int,
    tp: models.TenantProduct,
) -> str | None:
    image_filename = tp.image_filename
    if not image_filename and tp.provider_product_id:
        provider_product = session.get(models.ProviderProduct, tp.provider_product_id)
        if provider_product and provider_product.image_filename:
            provider = session.get(models.Provider, provider_product.provider_id)
            if provider:
                image_filename = (
                    f"providers/{provider.token}/products/{provider_product.image_filename}"
                )
    return resolve_product_image_url(tenant_id, image_filename)


def _translated_name(
    session: Session,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    canonical: str,
    lang: str,
) -> str:
    if lang == "en":
        return canonical
    translated = TranslationService.get_translated_field(
        session,
        tenant_id,
        entity_type,
        entity_id,
        "name",
        lang,
        canonical,
    )
    return translated or canonical


def _translated_description(
    session: Session,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    canonical: str | None,
    lang: str,
) -> str | None:
    if not canonical:
        return None
    if lang == "en":
        return canonical
    translated = TranslationService.get_translated_field(
        session,
        tenant_id,
        entity_type,
        entity_id,
        "description",
        lang,
        canonical,
    )
    return translated or canonical


def _load_flat_products(
    session: Session,
    tenant_id: int,
    lang: str,
    currency_code: str,
    *,
    include_source: bool = False,
    order_channel: str = models.OrderChannel.table.value,
) -> list[dict]:
    """Load customer-visible products using the same sources/filters as GET /menu/{table_token}."""
    all_tenant_products = session.exec(
        select(models.TenantProduct).where(
            models.TenantProduct.tenant_id == tenant_id,
        )
    ).all()

    tenant_products = [tp for tp in all_tenant_products if tp.is_active]

    legacy_products = session.exec(
        select(models.Product).where(
            models.Product.tenant_id == tenant_id,
            models.Product.is_active == True,  # noqa: E712
        )
    ).all()

    tenant = session.get(models.Tenant, tenant_id)
    today = _tenant_today(tenant)

    tenant_products = [
        tp
        for tp in tenant_products
        if _is_available_today(tp.available_from, tp.available_until, today)
    ]
    legacy_products = [
        p
        for p in legacy_products
        if _is_available_today(p.available_from, p.available_until, today)
    ]

    # Source-qualified identity is public so independent Product/TenantProduct IDs
    # cannot select the wrong dish. Customization questions remain POS-only.
    effective_product_ids = [
        tp.product_id for tp in tenant_products if tp.product_id is not None
    ]
    effective_product_ids.extend(
        product.id for product in legacy_products
        if product.id not in {tp.product_id for tp in tenant_products if tp.product_id is not None}
    )
    questions_by_product: dict[int, list[dict]] = {}
    if include_source and effective_product_ids:
        from .product_customization import choice_options_is_multi

        questions = session.exec(
            select(models.ProductQuestion).where(
                models.ProductQuestion.tenant_id == tenant_id,
                models.ProductQuestion.product_id.in_(effective_product_ids),
            ).order_by(models.ProductQuestion.sort_order, models.ProductQuestion.id)
        ).all()
        for question in questions:
            questions_by_product.setdefault(question.product_id, []).append({
                "id": question.id,
                "type": question.type.value if hasattr(question.type, "value") else str(question.type),
                "label": question.label,
                "options": question.options,
                "required": question.required,
                "multi": (
                    choice_options_is_multi(question.options)
                    if question.type == models.ProductQuestionType.choice else False
                ),
            })

    products: list[dict] = []

    linked_legacy_product_ids = {
        tp.product_id for tp in all_tenant_products if tp.product_id is not None
    }

    for tp in tenant_products:
        catalog_item = session.get(models.ProductCatalog, tp.catalog_id)
        category = catalog_item.category if catalog_item else None
        subcategory = catalog_item.subcategory if catalog_item else None
        description = None
        stock_fields: dict = {}
        image_url = None
        custom_product = None
        if tp.product_id:
            custom_product = session.get(models.Product, tp.product_id)
            if custom_product:
                # /products is the restaurant's management surface. For linked
                # catalog items, its edits must be the values guests see too.
                if custom_product.tenant_id != tenant_id or not custom_product.is_active or not _is_available_today(custom_product.available_from, custom_product.available_until, today):
                    continue
                category = custom_product.category or category
                subcategory = custom_product.subcategory or subcategory
                if custom_product.description:
                    description = custom_product.description
                image_url = resolve_product_image_url(
                    tenant_id, custom_product.image_filename
                )
                from .product_stock import product_stock_alert_payload

                stock_fields = product_stock_alert_payload(custom_product)
        if is_beratzade_demo_product(
            custom_product.name if custom_product else tp.name,
            tenant.name if tenant else None,
        ):
            continue
        if is_non_sellable_menu_heading(
            (custom_product.name if custom_product else tp.name), category
        ):
            continue
        if not description and catalog_item and catalog_item.description:
            description = catalog_item.description
        if not image_url:
            image_url = _resolve_tenant_product_image(session, tenant_id, tp)

        entity_type = "product" if custom_product else "tenant_product"
        entity_id = custom_product.id if custom_product else tp.id

        name = _translated_name(
            session,
            tenant_id,
            entity_type,
            entity_id,
            (custom_product.name if custom_product else tp.name) or "",
            lang,
        )
        description = _translated_description(
            session,
            tenant_id,
            entity_type,
            entity_id,
            description,
            lang,
        )

        row = {
                "id": tp.id,
                "source": "tenant_product",
                "name": name,
                "price_cents": custom_product.price_cents if custom_product else tp.price_cents,
                "price_formatted": format_public_price(
                    custom_product.price_cents if custom_product else tp.price_cents,
                    lang,
                ),
                "description": description,
                "category": category,
                "subcategory": subcategory,
                "image_url": image_url,
                "available": True,
                **stock_fields,
            }
        if include_source:
            row["questions"] = questions_by_product.get(custom_product.id, []) if custom_product else []
        products.append(row)

    for lp in legacy_products:
        if lp.id in linked_legacy_product_ids:
            continue
        if is_beratzade_demo_product(lp.name, tenant.name if tenant else None):
            continue
        if is_non_sellable_menu_heading(lp.name, lp.category):
            continue
        name = _translated_name(
            session, tenant_id, "product", lp.id, lp.name or "", lang
        )
        description = _translated_description(
            session, tenant_id, "product", lp.id, lp.description, lang
        )
        from .product_stock import product_stock_alert_payload

        row = {
                "id": lp.id,
                "source": "product",
                "name": name,
                "price_cents": lp.price_cents,
                "price_formatted": format_public_price(lp.price_cents, lang),
                "description": description,
                "category": lp.category,
                "subcategory": lp.subcategory,
                "image_url": resolve_product_image_url(tenant_id, lp.image_filename),
                "available": True,
                **product_stock_alert_payload(lp),
            }
        if include_source:
            row["questions"] = questions_by_product.get(lp.id, [])
        products.append(row)

    # ID 620 is an approved category heading stored as a product row. Filter by
    # its semantic name so the protection survives ID/source changes.
    products = [
        product for product in products
        if not is_non_sellable_menu_heading(product.get("name"), product.get("category"))
    ]

    eligible = promo_svc.eligible_promos(
        session,
        tenant_id=tenant_id,
        channel=order_channel,
    )
    for product in products:
        promo_svc.decorate_menu_product(
            session,
            tenant_id=tenant_id,
            product=product,
            channel=models.OrderChannel.table.value,
            eligible=eligible,
        )
        if product.get("list_price_cents") is not None:
            product["price_formatted"] = format_public_price(product["price_cents"], lang)
            product["list_price_formatted"] = format_public_price(
                product["list_price_cents"], lang
            )

    return products


def _uncategorized_section_label(lang: str) -> str:
    """Localized title for products without category/subcategory."""
    labels = {
        "en": "Other",
        "es": "Otros",
        "ca": "Altres",
        "de": "Sonstiges",
        "fr": "Autres",
    }
    locale = (lang or "en").strip().lower().split("-")[0]
    return labels.get(locale, labels["en"])


def _public_menu_section_title(product: dict, lang: str) -> str:
    """Display section: subcategory when set, else localized standard category label."""
    sub = (product.get("subcategory") or "").strip()
    if sub:
        return sub
    raw_category = (product.get("category") or "").strip()
    if not raw_category:
        return _uncategorized_section_label(lang)
    return get_public_category_display_label(raw_category, lang)


def _section_sort_key(display_name: str) -> tuple[int, str]:
    """Prefer common restaurant section order; unknown sections sort alphabetically."""
    hints: dict[str, int] = {
        "carta principal": 10,
        "especialidades": 20,
        "entrantes": 30,
        "ensaladas": 40,
        "starters": 50,
        "entrants": 50,
        "main course": 60,
        "plato principal": 60,
        "plat principal": 60,
        "beverages": 70,
        "bebidas": 70,
        "begudes": 70,
        "desserts": 80,
        "postres": 80,
        "sides": 90,
        "guarniciones": 90,
        "other": 999,
        "otros": 999,
    }
    rank = hints.get(display_name.strip().lower(), 500)
    return (rank, display_name.lower())


def group_products_into_categories(products: list[dict], lang: str = "en") -> list[dict]:
    """
    Group flat product dicts into menu sections for public/marketing UIs.

    Uses subcategory as the section when present; otherwise the localized
    standard category label (e.g. Desserts -> Postres for lang=es).
    """
    by_section: dict[str, list[dict]] = {}
    section_titles: dict[str, str] = {}

    for product in products:
        title = _public_menu_section_title(product, lang)
        section_id = _category_slug(title)
        section_titles.setdefault(section_id, title)
        by_section.setdefault(section_id, []).append(product)

    categories = []
    for section_id in sorted(
        by_section.keys(),
        key=lambda sid: _section_sort_key(section_titles[sid]),
    ):
        title = section_titles[section_id]
        items = sorted(by_section[section_id], key=lambda p: (p.get("name") or "").lower())
        categories.append(
            {
                "id": section_id,
                "name": title,
                "products": items,
            }
        )
    return categories


def group_products_into_category_tree(
    products: list[dict],
    custom_categories: dict[str, list[str]],
) -> list[dict]:
    """Build parent/child menu navigation without changing the legacy flat response."""
    category_names = list(custom_categories)
    for product in products:
        category = (product.get("category") or "").strip()
        if category and category not in category_names:
            category_names.append(category)

    tree = []
    for name in category_names:
        category_products = [
            product for product in products
            if (product.get("category") or "").strip() == name
        ]
        subcategory_names = list(custom_categories.get(name, []))
        for product in category_products:
            subcategory = (product.get("subcategory") or "").strip()
            if subcategory and subcategory not in subcategory_names:
                subcategory_names.append(subcategory)

        subcategories = []
        for subcategory in subcategory_names:
            subcategories.append(
                {
                    "id": _category_slug(subcategory),
                    "name": subcategory,
                    "products": [
                        product for product in category_products
                        if (product.get("subcategory") or "").strip() == subcategory
                    ],
                }
            )

        tree.append(
            {
                "id": _category_slug(name),
                "name": name,
                "products": [
                    product for product in category_products
                    if not (product.get("subcategory") or "").strip()
                ],
                "subcategories": subcategories,
            }
        )
    return tree


def build_public_tenant_menu(
    session: Session,
    tenant_id: int,
    lang: str,
    *,
    include_source: bool = False,
    order_channel: str = models.OrderChannel.table.value,
) -> dict:
    tenant = session.get(models.Tenant, tenant_id)
    if not tenant:
        return None  # type: ignore[return-value]

    currency_code, _currency_symbol = normalize_tenant_currency_fields(
        tenant.currency_code,
        tenant.currency,
    )
    tenant_name = tenant.name or ""
    if lang != "en":
        translated = TranslationService.get_translated_field(
            session, tenant.id, "tenant", tenant.id, "name", lang, tenant_name
        )
        if translated:
            tenant_name = translated

    products = _load_flat_products(
        session,
        tenant_id,
        lang,
        currency_code,
        include_source=include_source,
        order_channel=order_channel,
    )
    categories = group_products_into_categories(products, lang)
    custom_categories = normalize_custom_subcategories(tenant.custom_subcategories)
    category_tree = group_products_into_category_tree(products, custom_categories)
    existing_ids = {category["id"] for category in categories}
    for name in custom_categories:
        if name in STANDARD_CATEGORY_ORDER:
            continue
        category_id = _category_slug(name)
        if category_id not in existing_ids:
            categories.append({"id": category_id, "name": name, "products": []})
            existing_ids.add(category_id)
    categories.sort(key=lambda category: _section_sort_key(category["name"]))

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "currency": currency_code,
        "lang": lang,
        "categories": categories,
        "category_tree": category_tree,
    }


def assert_no_sensitive_product_fields(product: dict) -> None:
    """Raise AssertionError if internal product fields are present."""
    for key in _SENSITIVE_PRODUCT_KEYS:
        if key in product:
            raise AssertionError(f"Sensitive field {key!r} must not be exposed")
