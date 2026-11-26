-- Preserve historical references when an owner removes a user.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
