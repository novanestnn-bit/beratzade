from app.public_tenant_menu import group_products_into_category_tree


def test_category_tree_keeps_empty_categories_and_separates_subcategory_products():
    products = [
        {"id": 1, "name": "Menemen", "category": "Kahvaltı", "subcategory": "Menemenler"},
        {"id": 2, "name": "Kahvaltı tabağı", "category": "Kahvaltı", "subcategory": None},
    ]
    tree = group_products_into_category_tree(
        products,
        {"Kahvaltı": ["Fırın Ürünleri", "Menemenler"], "Kebap & Izgara": []},
    )

    breakfast = next(category for category in tree if category["name"] == "Kahvaltı")
    bakery = next(item for item in breakfast["subcategories"] if item["name"] == "Fırın Ürünleri")
    menemen = next(item for item in breakfast["subcategories"] if item["name"] == "Menemenler")
    kebab = next(category for category in tree if category["name"] == "Kebap & Izgara")

    assert bakery["products"] == []
    assert [item["name"] for item in menemen["products"]] == ["Menemen"]
    assert [item["name"] for item in breakfast["products"]] == ["Kahvaltı tabağı"]
    assert kebab["products"] == []
    assert kebab["subcategories"] == []
