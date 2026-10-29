-- Allow safe retries of staff-recorded payment legs without duplicating cash entries.
ALTER TABLE order_payment
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL;

ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_order_created_by_user_id
    ON "order" (created_by_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_payment_tenant_idempotency_key
    ON order_payment (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
