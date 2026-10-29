-- Extend the existing PostgreSQL enum for staff-only point-of-sale channels.
ALTER TYPE orderchannel ADD VALUE IF NOT EXISTS 'quick_sale';
ALTER TYPE orderchannel ADD VALUE IF NOT EXISTS 'takeaway';
