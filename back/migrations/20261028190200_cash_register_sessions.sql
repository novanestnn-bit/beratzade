CREATE TABLE IF NOT EXISTS cash_register_session (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),
    opened_by_user_id INTEGER NOT NULL REFERENCES "user"(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opening_cash_cents INTEGER NOT NULL CHECK (opening_cash_cents >= 0),
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    closed_by_user_id INTEGER REFERENCES "user"(id),
    closed_at TIMESTAMPTZ,
    counted_cash_cents INTEGER CHECK (counted_cash_cents >= 0),
    expected_cash_cents INTEGER CHECK (expected_cash_cents >= 0),
    variance_cents INTEGER,
    note VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS ix_cash_register_session_tenant_status
    ON cash_register_session (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_register_session_one_open_per_tenant
    ON cash_register_session (tenant_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS cash_register_movement (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),
    session_id INTEGER NOT NULL REFERENCES cash_register_session(id),
    movement_type VARCHAR(16) NOT NULL CHECK (movement_type IN ('cash_in', 'cash_out')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    note VARCHAR(500) NOT NULL,
    created_by_user_id INTEGER NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cash_register_movement_session_id
    ON cash_register_movement (session_id);
CREATE INDEX IF NOT EXISTS ix_cash_register_movement_created_by_user_id
    ON cash_register_movement (created_by_user_id);
CREATE INDEX IF NOT EXISTS ix_cash_register_movement_created_at
    ON cash_register_movement (created_at);

ALTER TABLE order_payment
    ADD COLUMN IF NOT EXISTS cash_register_session_id INTEGER
        REFERENCES cash_register_session(id);
CREATE INDEX IF NOT EXISTS ix_order_payment_cash_register_session_id
    ON order_payment (cash_register_session_id);
