-- ============================================
-- Migration: Add Order Counters Table
-- ============================================
-- This migration adds support for sequential order IDs
-- Format: STXXXXX (Stripe), SQXXXXX (Square), MSXXXXX (Manual)
--
-- Run this migration against your production database:
-- psql -d your_database_name -f migration_add_order_counters.sql

-- Add 'square' to payment_method_type enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method_type' AND e.enumlabel = 'square'
  ) THEN
    ALTER TYPE payment_method_type ADD VALUE 'square';
  END IF;
END $$;

-- Create order_counters table
CREATE TABLE IF NOT EXISTS order_counters (
  type VARCHAR(20) PRIMARY KEY, -- 'stripe', 'square', 'manual'
  counter INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_counters IS 'Sequential counters for generating formatted order IDs';
COMMENT ON COLUMN order_counters.type IS 'Order source: stripe, square, or manual';
COMMENT ON COLUMN order_counters.counter IS 'Current counter value (increments atomically)';

-- Create trigger to update timestamp
CREATE TRIGGER update_order_counters_updated_at BEFORE UPDATE ON order_counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initialize counters (starting at 0, will increment to 1 on first use)
INSERT INTO order_counters (type, counter) VALUES
  ('stripe', 0),
  ('square', 0),
  ('manual', 0)
ON CONFLICT (type) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Order counters table created and initialized.';
  RAISE NOTICE 'New orders will use format: STXXXXX (Stripe), SQXXXXX (Square), MSXXXXX (Manual)';
END $$;
