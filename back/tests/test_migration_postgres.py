"""Opt-in regressions against a dedicated disposable PostgreSQL container only.

READINESS_DATABASE_URL must point at beratzade-readiness-db/readiness.
Every test creates a new database; no existing database is reset or dropped.
"""
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ProgrammingError
from sqlmodel import Session

from app import migrate


@pytest.fixture
def database(monkeypatch):
    raw = os.environ.get("READINESS_DATABASE_URL")
    if not raw:
        pytest.skip("READINESS_DATABASE_URL is required for disposable PostgreSQL tests")
    url = make_url(raw)
    assert url.host == "beratzade-readiness-db" and url.database == "readiness"
    name = "readiness_" + uuid4().hex
    admin = create_engine(url, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
    admin.dispose()
    engine = create_engine(url.set(database=name), hide_parameters=True)
    monkeypatch.setattr(migrate, "engine", engine)
    yield engine
    engine.dispose()


def test_full_chain_repeat_and_existing_unversioned_data(database):
    runner = migrate.MigrationRunner(Path(__file__).resolve().parents[1] / "migrations")
    runner.run_migrations(dry_run=True)
    assert not inspect(database).has_table("schema_version")
    version = runner.run_migrations()
    assert version == 20261028190200
    runner.run_sync_idempotent()
    from app.models import Tenant
    with Session(database) as session:
        tenant = Tenant(name="Readiness preserved tenant")
        session.add(tenant)
        session.commit()
        session.refresh(tenant)
        tenant_id = tenant.id
    with database.begin() as connection:
        connection.execute(text("CREATE TABLE readiness_marker (id integer PRIMARY KEY, value text NOT NULL)"))
        connection.execute(text("INSERT INTO readiness_marker VALUES (1, 'preserve')"))
        # Simulate a full pre-existing schema with missing migration history.
        connection.execute(text("DELETE FROM schema_version"))
    assert runner.run_migrations() == version
    assert runner.run_migrations() == version
    with database.connect() as connection:
        assert connection.execute(text("SELECT name FROM tenant WHERE id=:id"), {"id": tenant_id}).scalar_one() == "Readiness preserved tenant"
        assert connection.execute(text("SELECT value FROM readiness_marker WHERE id=1")).scalar_one() == "preserve"
        assert connection.execute(text("SELECT count(*) FROM schema_version")).scalar_one() == len(runner.get_migration_files())


def test_migration_error_rolls_back_and_is_not_recorded(database, tmp_path):
    (tmp_path / "001_invalid.sql").write_text("CREATE TABLE rollback_marker (id int); ALTER TABLE absent ADD COLUMN value int;")
    runner = migrate.MigrationRunner(tmp_path)
    with pytest.raises(ProgrammingError) as error:
        runner.run_migrations()
    assert error.value.orig.sqlstate == "42P01"
    assert not inspect(database).has_table("rollback_marker")
    with Session(database) as session:
        assert runner.get_applied_versions(session) == set()


def test_repair_errors_are_not_silenced(database, tmp_path):
    (tmp_path / "001_invalid.sql").write_text("CREATE TABLE rollback_marker (id int); SELECT * FROM absent;")
    with pytest.raises(ProgrammingError):
        migrate.MigrationRunner(tmp_path).run_sync_idempotent()
    assert not inspect(database).has_table("rollback_marker")


def test_concurrent_migrations_run_once(database, tmp_path):
    (tmp_path / "001_once.sql").write_text("CREATE TABLE run_once (id int); SELECT pg_sleep(0.2);")
    runner = migrate.MigrationRunner(tmp_path)
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert list(executor.map(lambda _: runner.run_migrations(), range(2))) == [1, 1]


def test_duplicate_versions_fail(database, tmp_path):
    (tmp_path / "001_a.sql").write_text("SELECT 1;")
    (tmp_path / "001_b.sql").write_text("SELECT 1;")
    with pytest.raises(RuntimeError, match="Duplicate migration versions"):
        migrate.MigrationRunner(tmp_path).run_migrations()


def test_missing_migrations_fail(database, tmp_path):
    with pytest.raises(RuntimeError, match="Migrations directory not found"):
        migrate.MigrationRunner(tmp_path / "absent").run_migrations()


def test_original_create_all_reproduces_missing_enum_f405(database):
    from app import models, inventory_models
    from sqlmodel import SQLModel
    with pytest.raises(ProgrammingError) as error:
        SQLModel.metadata.create_all(database)
    assert error.value.orig.sqlstate == "42704"
    assert "staff_contract_kind" in str(error.value.orig)


def test_historical_cleanup_cannot_delete_existing_orders(database):
    from app.models import Tenant, Order
    runner = migrate.MigrationRunner(Path(__file__).resolve().parents[1] / "migrations")
    runner.run_migrations()
    with Session(database) as session:
        tenant = Tenant(name="Preserve order history")
        session.add(tenant)
        session.commit()
        session.refresh(tenant)
        order = Order(tenant_id=tenant.id)
        session.add(order)
        session.commit()
        session.refresh(order)
        order_id = order.id
        session.exec(text("DELETE FROM schema_version WHERE version=20260315120000"))
        session.commit()
    with pytest.raises(RuntimeError, match="Existing orders detected"):
        runner.run_migrations()
    with database.connect() as connection:
        assert connection.execute(text('SELECT count(*) FROM "order" WHERE id=:id'), {"id": order_id}).scalar_one() == 1
