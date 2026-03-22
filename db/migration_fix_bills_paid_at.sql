-- Add paid_at column to bills table to track when payments are confirmed by the owner
ALTER TABLE bills ADD COLUMN paid_at TIMESTAMPTZ;
