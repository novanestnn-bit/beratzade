"""Database settings and entrypoint regressions, without contacting a database."""
from unittest.mock import patch

import pytest

from app.settings import Settings


def configuration(**overrides):
    values = dict(PRODUCTION=False, DATABASE_URL="", DB_HOST="localhost")
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_render_url_precedes_db_fields_and_preserves_ssl(scheme):
    url = configuration(DATABASE_URL=f"{scheme}://user:p%40ss%2Fword@internal/db?sslmode=require").database_url
    assert url.drivername == "postgresql+psycopg"
    assert url.host == "internal"
    assert url.password == "p@ss/word"
    assert url.query["sslmode"] == "require"
    assert "p@ss/word" not in str(url)


def test_db_field_password_is_not_parsed_as_url_syntax():
    config = configuration(DB_PASSWORD="p@ss:/?#%word", DB_HOST="database", DB_PORT=5433)
    assert config.database_url.password == "p@ss:/?#%word"
    assert config.database_url.host == "database"
    assert config.database_url.port == 5433


@pytest.mark.parametrize("value", ["mysql://user:secret@host/db", "not-a-url-secret", "postgresql:///db"])
def test_invalid_url_is_rejected_without_echoing_secret(value):
    with pytest.raises(ValueError) as error:
        configuration(DATABASE_URL=value)
    assert "valid PostgreSQL URL" in str(error.value)
    assert value not in str(error.value)


def test_production_requires_explicit_database_configuration(monkeypatch):
    monkeypatch.delenv("DB_HOST", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValueError, match="Production requires DATABASE_URL"):
        Settings(_env_file=None, PRODUCTION=True)


def test_start_honours_render_port(monkeypatch):
    from app.start import main
    monkeypatch.setenv("PORT", "10000")
    with patch("app.start.uvicorn.run") as run:
        main()
    run.assert_called_once_with("app.main:app", host="0.0.0.0", port=10000, reload=False)


def test_start_default_port(monkeypatch):
    from app.start import main
    monkeypatch.delenv("PORT", raising=False)
    with patch("app.start.uvicorn.run") as run:
        main()
    assert run.call_args.kwargs["port"] == 8020


@pytest.mark.parametrize("value", ["0", "65536", "invalid"])
def test_start_rejects_invalid_port(monkeypatch, value):
    from app.start import main
    monkeypatch.setenv("PORT", value)
    with pytest.raises(ValueError):
        main()


def test_production_disallows_create_all(monkeypatch):
    from app import db
    monkeypatch.setattr(db.settings, "is_production", True)
    with patch.object(db.SQLModel.metadata, "create_all") as create:
        with pytest.raises(RuntimeError, match="Production schema changes"):
            db.create_db_and_tables()
    create.assert_not_called()


def test_database_failure_aborts_app_startup(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    with patch.object(main, "check_db_connection", side_effect=RuntimeError("private diagnostics")):
        with pytest.raises(RuntimeError, match="Database initialization failed") as error:
            with TestClient(main.app):
                pass
    assert "private diagnostics" not in str(error.value)


def test_migration_failure_aborts_app_startup():
    from fastapi.testclient import TestClient
    from app import main
    with patch.object(main, "check_db_connection"), patch(
        "app.migrate.MigrationRunner.run_migrations", side_effect=RuntimeError("migration failed")
    ):
        with pytest.raises(RuntimeError, match="Database initialization failed"):
            with TestClient(main.app):
                pass


def test_database_health_failure_does_not_expose_details():
    from fastapi.testclient import TestClient
    from app import main
    with patch.object(main, "check_db_connection", side_effect=RuntimeError("private connection details")):
        response = TestClient(main.app).get("/health/db")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
