import pytest

from app.seeds.seed_beratzade_menu import (
    CATEGORIES,
    MENU,
    TENANT_ID,
    _deactivate_known_legacy_rows,
    _menu_product_id_map,
    normalize_name,
    menu_subcategory,
    SUBCATEGORIES,
    validate_seed_environment,
)


def test_brochure_subcategories_replace_legacy_meat_and_chicken_groups():
    assert menu_subcategory("Izgara & Kebap Çeşitleri", "Adana Dürüm") == "Dürümler & Ekmek Arası"
    assert menu_subcategory("Izgara & Kebap Çeşitleri", "Köfte Ekmek") == "Dürümler & Ekmek Arası"
    assert menu_subcategory("Izgara & Kebap Çeşitleri", "Tavuk Şiş Servis") == "Servisler"
    assert menu_subcategory("Beratzade Sandviç Menüsü", "Çeyrek Sandviç") == "Çeyrek Sandviç"
    assert menu_subcategory("Tost Çeşitleri", "Kaşarlı Tost") is None
    assert all(category in CATEGORIES for category in SUBCATEGORIES)


def test_admin_category_list_uses_the_restaurant_menu_not_global_catalog():
    from types import SimpleNamespace
    from unittest.mock import Mock
    from app.tenant_subcategories import tenant_categories_for_ui

    session = Mock()
    session.get.return_value = SimpleNamespace(
        name="Beratzade Kebap & Kahvaltı Salonu",
        custom_subcategories={category: SUBCATEGORIES.get(category, []) for category in CATEGORIES},
    )
    categories = tenant_categories_for_ui(session, TENANT_ID)
    assert list(categories) == CATEGORIES
    assert categories["Izgara & Kebap Çeşitleri"] == ["Dürümler & Ekmek Arası", "Servisler"]
    session.exec.assert_not_called()


def test_approved_menu_catalog_has_57_priced_items_and_16_categories():
    assert len(MENU) == 57
    assert len(CATEGORIES) == 16
    assert len({normalize_name(row[1]) for row in MENU}) == len(MENU)
    assert "Günlük Sulu Yemekler" in CATEGORIES
    assert "Çorba Çeşitleri" in CATEGORIES
    assert all("DEMO" not in name.upper() for _, name, _, _ in MENU)
    assert TENANT_ID == 89


def test_existing_product_ids_are_kept_for_approved_duplicate_and_sutlac_alias():
    product_ids = _menu_product_id_map()
    assert product_ids[normalize_name("Urfa Kebap Servis")] == 613
    assert product_ids[normalize_name("Fırın Sütlaç")] == 621


def test_known_duplicate_and_headings_are_inactivated_without_deleting_rows():
    from types import SimpleNamespace
    from unittest.mock import Mock

    rows = {
        612: SimpleNamespace(id=612, tenant_id=89, name="Urfa Kebap Servis", is_active=True),
        604: SimpleNamespace(id=604, tenant_id=89, name="günlük taze çorba", is_active=True),
        620: SimpleNamespace(id=620, tenant_id=89, name="Günlük Sulu Yemekler", is_active=True),
    }
    session = Mock()
    session.get.side_effect = lambda _model, product_id: rows.get(product_id)

    assert _deactivate_known_legacy_rows(session, 89) == 3
    assert all(not row.is_active for row in rows.values())
    assert session.add.call_count == 3


def test_legacy_deactivation_does_not_touch_other_tenants_or_mismatched_rows():
    from types import SimpleNamespace
    from unittest.mock import Mock

    other_tenant_row = SimpleNamespace(id=612, tenant_id=1, name="Urfa Kebap Servis", is_active=True)
    session = Mock()
    session.get.side_effect = lambda _model, product_id: other_tenant_row if product_id == 612 else None

    assert _deactivate_known_legacy_rows(session, 89) == 0
    assert other_tenant_row.is_active is True
    session.add.assert_not_called()

    mismatched = SimpleNamespace(id=612, tenant_id=89, name="Another product", is_active=True)
    session.get.side_effect = lambda _model, product_id: mismatched if product_id == 612 else None
    with pytest.raises(RuntimeError, match="approved legacy mapping"):
        _deactivate_known_legacy_rows(session, 89)
    assert mismatched.is_active is True


def test_import_refuses_production_and_requires_local_opt_in():
    with pytest.raises(RuntimeError, match="production"):
        validate_seed_environment(
            production=True,
            opt_in=True,
            database_host="db",
            database_name="pos",
            tenant_ref="beratzade-kebap-kahvalti-salonu",
        )
    with pytest.raises(RuntimeError, match="explicitly run"):
        validate_seed_environment(
            production=False,
            opt_in=False,
            database_host="db",
            database_name="pos",
            tenant_ref="beratzade-kebap-kahvalti-salonu",
        )


def test_production_import_requires_two_explicit_gates_and_tenant_89():
    with pytest.raises(RuntimeError, match="BERATZADE_MENU_CONFIRM_TENANT_ID"):
        validate_seed_environment(
            production=True,
            opt_in=False,
            production_opt_in=True,
            confirmed_tenant_id=1,
            database_host="database.internal",
            database_name="beratzade",
            tenant_ref="",
        )

    validate_seed_environment(
        production=True,
        opt_in=False,
        production_opt_in=True,
        confirmed_tenant_id=89,
        database_host="database.internal",
        database_name="beratzade",
        tenant_ref="",
    )


def test_import_refuses_wrong_database_or_tenant():
    with pytest.raises(RuntimeError, match="local Docker pos database"):
        validate_seed_environment(
            production=False,
            opt_in=True,
            database_host="production-db",
            database_name="pos",
            tenant_ref="beratzade-kebap-kahvalti-salonu",
        )
    with pytest.raises(RuntimeError, match="LOCAL_DEV_TENANT_REF"):
        validate_seed_environment(
            production=False,
            opt_in=True,
            database_host="db",
            database_name="pos",
            tenant_ref="other-restaurant",
        )
