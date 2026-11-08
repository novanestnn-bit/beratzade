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
