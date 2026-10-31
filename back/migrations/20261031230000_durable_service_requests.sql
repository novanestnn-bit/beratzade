-- Additive only: no existing business rows are changed.
CREATE TABLE IF NOT EXISTS service_request (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),
    table_id INTEGER NOT NULL REFERENCES "table"(id),
    order_id INTEGER REFERENCES "order"(id),
    kind VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    message VARCHAR(500), payment_method VARCHAR(24),
    idempotency_key VARCHAR(128), request_hash VARCHAR(64) NOT NULL,
    assigned_waiter_id INTEGER REFERENCES "user"(id),
    handled_by_user_id INTEGER REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_service_request_key UNIQUE(table_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_service_request_tenant_status ON service_request(tenant_id,status,id);
CREATE INDEX IF NOT EXISTS ix_service_request_table_id ON service_request(table_id);
CREATE TABLE IF NOT EXISTS order_submission (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),
    table_id INTEGER NOT NULL REFERENCES "table"(id),
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    order_id INTEGER NOT NULL REFERENCES "order"(id),
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_order_submission_key UNIQUE(table_id,idempotency_key)
);
