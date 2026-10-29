-- Add staff counter / pickup sale idempotency without touching existing orders.
ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS staff_sale_idempotency_key VARCHAR(64);

ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS staff_sale_payload_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_tenant_staff_sale_key
    ON "order" (tenant_id, staff_sale_idempotency_key);
