import pytest

from app import models
from app.db import engine
from app.seeds import seed_beratzade_demo_menu as seed
from app.settings import settings


def test_seed_guard_requires_explicit_local_opt_in():
    with pytest.raises(RuntimeError, match="ALLOW_BERATZADE_DEMO_SEED"):
        seed.validate_seed_environment(
            production=False,
            explicit_opt_in=False,
            database_host="db",
            database_name="pos",
            tenant_ref=seed.PUBLIC_SLUG,
        )


def test_seed_guard_rejects_production_even_with_opt_in():
    with pytest.raises(RuntimeError, match="production"):
        seed.validate_seed_environment(
            production=True,
            explicit_opt_in=True,
            database_host="db",
            database_name="pos",
            tenant_ref=seed.PUBLIC_SLUG,
        )


def test_seed_guard_rejects_non_local_database_or_tenant():
    with pytest.raises(RuntimeError, match="local pos database"):
        seed.validate_seed_environment(
            production=False,
            explicit_opt_in=True,
            database_host="production-db",
            database_name="pos",
            tenant_ref=seed.PUBLIC_SLUG,
        )
    with pytest.raises(RuntimeError, match="LOCAL_DEV_TENANT_REF"):
        seed.validate_seed_environment(
            production=False,
            explicit_opt_in=True,
            database_host="db",
            database_name="pos",
            tenant_ref="1",
        )


def test_run_rejects_production_before_opening_session(monkeypatch):
    monkeypatch.setattr(settings, "is_production", True)
    monkeypatch.setattr(settings, "local_dev_tenant_ref", seed.PUBLIC_SLUG)
    monkeypatch.setenv("ALLOW_BERATZADE_DEMO_SEED", "1")

    def forbidden_session(*args, **kwargs):
        raise AssertionError("Session must not be created after a production rejection")

    monkeypatch.setattr(seed, "Session", forbidden_session)
    with pytest.raises(RuntimeError, match="production"):
        seed.run()
