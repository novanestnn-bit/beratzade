from app.public_tenant_menu import (
    beratzade_menu_category_description,
    beratzade_menu_category_names,
    group_products_into_category_tree,
)


def test_beratzade_menu_exposes_the_same_sixteen_categories_even_when_empty():
    names = beratzade_menu_category_names()
    assert len(names) == 16
    tree = group_products_into_category_tree([], {name: [] for name in names})
    assert [category["name"] for category in tree] == names
    assert all(category["products"] == [] and category["subcategories"] == [] for category in tree)


def test_daily_meal_category_notes_match_the_approved_menu_and_other_categories_stay_blank():
    meals = beratzade_menu_category_description("Günlük Sulu Yemekler")
    soups = beratzade_menu_category_description("Çorba Çeşitleri")
    assert meals == (
        "Her gün taze hazırlanan 5-6 çeşit sulu yemek. Günün yemekleri günlük olarak "
        "değişir. Çeşitler ve fiyatlar günlük menüde belirtilir."
    )
    assert soups == "Günün taze çorbaları değişiklik gösterir."
    assert beratzade_menu_category_description("Pilav") is None
