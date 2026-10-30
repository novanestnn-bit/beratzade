# Beratzade backend production preparation

No Render or Vercel deployment is performed by these changes. Deployment needs operator approval.

## Findings and changes

- `DATABASE_URL` was ignored. Settings now prefer it over `DB_*`, normalize PostgreSQL URLs to psycopg 3, preserve SSL query options, and safely encode separate password fields with SQLAlchemy's URL object.
- `create_all()` before migrations fails on a blank PostgreSQL database: `staff_contract_kind` is declared with `create_type=False`, producing `UndefinedObject` (SQLSTATE 42704, SQLAlchemy ProgrammingError/f405). This was reproduced locally; the original Render log is still needed to establish whether its error has the same cause.
- Startup formerly logged migration failures and continued serving. It now checks connectivity, applies versioned SQL migrations, and aborts before accepting traffic on failure.
- `000_initial_schema.sql` is a frozen snapshot of 68 model tables and native enum types. It runs before historical ALTER migrations, creates missing tables and their indexes/constraints, and leaves existing tables and rows intact. Foreign key cycles are resolved after table creation. Historical migrations remain unchanged.
- Migration execution is serialized with a PostgreSQL advisory lock held on one pinned connection. Each migration and its history entry commit together; failures roll back and remain pending. Duplicate versions and missing migration files fail explicitly.
- Historical migration `20260315120000_remove_empty_orders.sql` deletes orders. The runner now refuses to run or replay it whenever existing orders are present. It remains pending for operator review; no automatic approval or migration-history rewrite bypasses this guard.
- `--check` does not create or change schema/history. `--sync-idempotent` is an explicit repair tool: failures now abort and roll back that file instead of being silently skipped. Do not automatically run repair on production; historical SQL includes data changes.
- Connection pools have configurable bounds, pre-ping, recycle and connect timeouts. SQL parameters and database URLs are not printed in startup errors. Failure logs identify migration file, statement number, exception type and SQLSTATE.
- The container uses `python -m app.start`, binds `0.0.0.0`, honours `PORT` (default 8020), and disables reload. No frontend changes are included.

## Render settings for a later approved deployment

Use the repository backend directory as the Docker build context: Root Directory `back`, Dockerfile `./Dockerfile`. Leave the Docker Command override empty to use the image CMD, or explicitly use `python -m app.start`. No host dependency installation is needed. Render supplies `PORT`; do not hardcode a port override.

Set secrets in Render, never in committed files:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Internal URL from the PostgreSQL service in the same region/private network |
| `PRODUCTION` | `true` |
| `SECRET_KEY` | Strong independently generated signing secret |
| `REFRESH_SECRET_KEY` | Different strong signing secret |
| `CORS_ORIGINS` | Exact approved frontend HTTPS origins, comma separated |
| `PUBLIC_APP_BASE_URL` | Approved frontend HTTPS URL |
| `ROOT_PATH` | Empty for a backend served directly at its Render origin; `/api` only behind a prefix-stripping proxy |
| `REDIS_URL` | Private Redis URL when enabling pub/sub and realtime services |
| `RATE_LIMIT_REDIS_URL` | Private Redis URL when shared rate limit storage is required |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` | Optional; defaults 5 + 5 per process |
| `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`, `DB_CONNECT_TIMEOUT` | Optional seconds; defaults 30, 1800, 10 |

Existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` deployments continue working when `DATABASE_URL` is unset/empty. Production refuses an implicit localhost fallback. `PRODUCTION=true` must be set explicitly and existing secret/CORS validation remains enabled.

Use `/health/db` as the database-aware Render health check. `/health` remains the lightweight liveness endpoint. Startup applies only pending migrations, under a lock, before serving requests; an optional pre-deploy `python -m app.migrate` uses the same runner. Back up and inspect the existing production schema/history before authorizing either method. An already-recorded migration is not automatically replayed to repair a partially damaged database.

## Local regression checks

Use the existing backend image and a dedicated PostgreSQL container named `beratzade-readiness-db`. The PostgreSQL tests require `READINESS_DATABASE_URL` pointing specifically to that host and database `readiness`; they create unique test databases without resetting any existing database. Do not point them at production.

Run inside the backend image:

```sh
python -m pytest -q tests/test_database_startup.py tests/test_migration_postgres.py
```

Supply `DATABASE_URL` and `READINESS_DATABASE_URL` from the isolated test setup. Coverage includes URL credentials/SSL, Render port, production create_all guard, failed startup, full migration chain, rerun with unversioned existing data, rollback, concurrent startup, and the original missing-enum failure.

## Remaining scope

Actual Render PostgreSQL logs, live schema inventory, backup verification and deployment remain outstanding. Frontend/Vercel configuration, browser/mobile flows, Redis/websocket topology, cross-site cookies and a full security review require separate follow-up. The full backend suite must also run before production approval; focused tests do not establish full application readiness.

References: [Render web services](https://render.com/docs/web-services), [Docker on Render](https://render.com/docs/docker), [SQLAlchemy URL configuration](https://docs.sqlalchemy.org/en/20/core/engines.html), [SQLAlchemy error reference](https://docs.sqlalchemy.org/en/20/errors.html).
