-- Allow owners to hide a product from the public customer menu without deleting it.
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS ix_product_is_active ON product (is_active);
