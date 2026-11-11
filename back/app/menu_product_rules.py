"""Shared rules for rows that look like categories but are stored as products."""

from __future__ import annotations

import re
import unicodedata


def normalize_menu_product_name(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", without_marks.lower().replace("ı", "i")).strip()


def is_non_sellable_menu_heading(name: str | None, category: str | None) -> bool:
    """The approved daily-meals heading must not be exposed or accepted as a dish."""
    return (
        normalize_menu_product_name(name) == "gunluk sulu yemekler"
        and normalize_menu_product_name(category) == "gunun yemekleri"
    )


_BERATZADE_TENANT_NAMES = {
    "beratzade kebap kahvalti salonu",
    "beratzade kebap ve kahvalti salonu",
}
_BERATZADE_GENERIC_DEMO_NAMES = {
    "enchiladas",
    "chile relleno",
    "tacos de carne asada",
    "mole poblano",
    "pozole",
    "coca cola",
    "tecate roja",
    "tecate light",
    "water",
    "coffee",
}


def is_beratzade_tenant_name(value: str | None) -> bool:
    return normalize_menu_product_name(value) in _BERATZADE_TENANT_NAMES


def is_beratzade_demo_product(name: str | None, tenant_name: str | None) -> bool:
    """Keep explicitly labeled and generic seed fixtures out of Beratzade menus."""
    if not is_beratzade_tenant_name(tenant_name):
        return False
    normalized = normalize_menu_product_name(name)
    return normalized.startswith("demo ") or normalized in _BERATZADE_GENERIC_DEMO_NAMES
