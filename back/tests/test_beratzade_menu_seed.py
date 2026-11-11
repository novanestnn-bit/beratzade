import pytest

from app.seeds.seed_beratzade_menu import (
    CATEGORIES,
    MENU,
    normalize_name,
    validate_seed_environment,
)


def test_approved_menu_catalog_has_57_priced_items_and_16_categories():
    assert len(MENU) == 57
    assert len(CATEGORIES) == 16
    assert len({normalize_name(row[1]) for row in MENU}) == len(MENU)
    assert "Günlük Sulu Yemekler" in CATEGORIES
    assert "Çorba Çeşitleri" in CATEGORIES
    assert all("DEMO" not in name.upper() for _, name, _, _ in MENU)


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
