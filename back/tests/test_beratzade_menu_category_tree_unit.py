from app.public_tenant_menu import beratzade_menu_category_names, group_products_into_category_tree


def test_beratzade_menu_exposes_the_same_sixteen_categories_even_when_empty():
    names = beratzade_menu_category_names()
    assert len(names) == 16
    tree = group_products_into_category_tree([], {name: [] for name in names})
    assert [category["name"] for category in tree] == names
    assert all(category["products"] == [] and category["subcategories"] == [] for category in tree)
