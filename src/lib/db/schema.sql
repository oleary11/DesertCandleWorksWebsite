-- ============================================
-- Desert Candle Works - Postgres Schema
-- ============================================
-- This schema migrates data from Redis to Postgres
-- for a more scalable and maintainable database

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'User accounts for rewards program';
COMMENT ON COLUMN users.points IS 'Current points balance (denormalized from transactions)';

-- Index for fast email lookups (authentication)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ============================================
-- ORDERS
-- ============================================

CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE shipping_status AS ENUM ('pending', 'shipped', 'delivered');
CREATE TYPE payment_method_type AS ENUM ('stripe', 'cash', 'card', 'square', 'other');

CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY, -- Order ID (format: STXXXXX for Stripe, SQXXXXX for Square, MSXXXXX for Manual)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT false,

  -- Pricing breakdown
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  product_subtotal_cents INTEGER CHECK (product_subtotal_cents >= 0),
  shipping_cents INTEGER CHECK (shipping_cents >= 0),
  tax_cents INTEGER CHECK (tax_cents >= 0),

  -- Points & Promotions
  points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  points_redeemed INTEGER DEFAULT 0 CHECK (points_redeemed >= 0),
  promotion_id VARCHAR(100),

  -- Payment information
  payment_method payment_method_type,
  notes TEXT, -- Admin notes for manual sales

  -- Order status
  status order_status NOT NULL DEFAULT 'pending',
  shipping_status shipping_status DEFAULT 'pending',

  -- Shipping information
  tracking_number VARCHAR(100),
  phone VARCHAR(50),
  shipping_name VARCHAR(200),
  shipping_line1 VARCHAR(255),
  shipping_line2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_postal_code VARCHAR(20),
  shipping_country VARCHAR(2) DEFAULT 'US',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

COMMENT ON TABLE orders IS 'Customer orders (both authenticated users and guests)';
COMMENT ON COLUMN orders.product_subtotal_cents IS 'Products only (for points calculation)';

-- Indexes for common queries
CREATE INDEX idx_orders_user_id ON orders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_shipping_status ON orders(shipping_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_tracking ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- Order items (denormalized from JSON array in Redis)
CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_slug VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_id VARCHAR(100), -- For variant products (wick-scent combination)
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_slug ON order_items(product_slug);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE products (
  slug VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stripe_price_id VARCHAR(100),
  image_url TEXT,
  best_seller BOOLEAN DEFAULT false,
  young_dumb BOOLEAN DEFAULT false,

  -- Variant configuration stored as JSONB for flexibility
  -- Contains wickTypes, variantData, etc.
  variant_config JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE products IS 'Product catalog with variants';
COMMENT ON COLUMN products.variant_config IS 'JSONB containing wick types, scent IDs, and stock per variant';

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_best_seller ON products(best_seller) WHERE best_seller = true;
CREATE INDEX idx_products_stock ON products(stock) WHERE stock > 0;

-- Optional: Normalize variants into separate table (future optimization)
-- CREATE TABLE product_variants (
--   id BIGSERIAL PRIMARY KEY,
--   product_slug VARCHAR(100) NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
--   variant_id VARCHAR(100) NOT NULL, -- e.g., "soy-vanilla"
--   wick_type_id VARCHAR(50),
--   scent_id VARCHAR(50),
--   stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
--   UNIQUE(product_slug, variant_id)
-- );

-- ============================================
-- POINTS TRANSACTIONS
-- ============================================

CREATE TYPE transaction_type AS ENUM ('earn', 'redeem', 'admin_adjustment');

CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive for earn, negative for redeem
  type transaction_type NOT NULL,
  description TEXT NOT NULL,
  order_id VARCHAR(255) REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE points_transactions IS 'Audit log for points earned, redeemed, and adjusted';

CREATE INDEX idx_points_transactions_user_id ON points_transactions(user_id, created_at DESC);
CREATE INDEX idx_points_transactions_order_id ON points_transactions(order_id) WHERE order_id IS NOT NULL;

-- ============================================
-- PURCHASES (Business Expenses)
-- ============================================

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(255) NOT NULL,
  purchase_date DATE NOT NULL,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  receipt_image_url TEXT, -- Vercel Blob URL
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchases IS 'Business expense tracking for cost analysis';

CREATE INDEX idx_purchases_vendor ON purchases(vendor_name);
CREATE INDEX idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX idx_purchases_created_at ON purchases(created_at DESC);

CREATE TABLE purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  category VARCHAR(50) NOT NULL, -- wax, wicks, bottles, scents, labels, packaging, equipment, other
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_category ON purchase_items(category);

-- ============================================
-- PROMOTIONS
-- ============================================

CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');

CREATE TABLE promotions (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  discount_type discount_type NOT NULL,
  discount_value INTEGER NOT NULL CHECK (discount_value >= 0), -- percentage (0-100) or cents
  min_purchase_cents INTEGER DEFAULT 0 CHECK (min_purchase_cents >= 0),
  max_redemptions INTEGER CHECK (max_redemptions > 0),
  current_redemptions INTEGER NOT NULL DEFAULT 0 CHECK (current_redemptions >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE promotions IS 'Discount codes and promotional campaigns';

CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_active ON promotions(active) WHERE active = true;

-- ============================================
-- REFUNDS
-- ============================================

CREATE TYPE refund_reason AS ENUM (
  'customer_request',
  'damaged_product',
  'wrong_item_sent',
  'quality_issue',
  'shipping_delay',
  'duplicate_order',
  'other'
);

CREATE TYPE refund_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stripe_refund_id VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  reason refund_reason NOT NULL,
  reason_note TEXT,
  status refund_status NOT NULL DEFAULT 'pending',
  restore_inventory BOOLEAN NOT NULL DEFAULT true,
  points_to_deduct INTEGER DEFAULT 0 CHECK (points_to_deduct >= 0),
  processed_by VARCHAR(100), -- admin user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

COMMENT ON TABLE refunds IS 'Refund requests and processing status';

CREATE INDEX idx_refunds_order_id ON refunds(order_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at DESC);

CREATE TABLE refund_items (
  id BIGSERIAL PRIMARY KEY,
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  product_slug VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_id VARCHAR(100),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refund_amount_cents INTEGER NOT NULL CHECK (refund_amount_cents >= 0)
);

CREATE INDEX idx_refund_items_refund_id ON refund_items(refund_id);

-- ============================================
-- ALCOHOL TYPES (Metadata)
-- ============================================

CREATE TABLE alcohol_types (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 9999,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE alcohol_types IS 'Categorization for alcohol-scented products';

CREATE INDEX idx_alcohol_types_sort ON alcohol_types(sort_order, name);
CREATE INDEX idx_alcohol_types_active ON alcohol_types(archived) WHERE archived = false;

-- ============================================
-- TOKENS & SESSIONS
-- ============================================

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  token VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
  token VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_expires ON email_verification_tokens(expires_at);

-- Invoice access tokens (for guest orders)
CREATE TABLE invoice_access_tokens (
  token VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_tokens_order_id ON invoice_access_tokens(order_id);
CREATE INDEX idx_invoice_tokens_expires ON invoice_access_tokens(expires_at);

-- ============================================
-- WEBHOOK EVENT TRACKING (Deduplication)
-- ============================================

CREATE TABLE webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

COMMENT ON TABLE webhook_events IS 'Webhook event deduplication (TTL: 7 days)';

CREATE INDEX idx_webhook_events_expires ON webhook_events(expires_at);

-- ============================================
-- AUTOMATIC UPDATED_AT TRIGGER
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alcohol_types_updated_at BEFORE UPDATE ON alcohol_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ORDER COUNTERS
-- ============================================
-- Sequential counters for generating order IDs (STXXXXX, SQXXXXX, MSXXXXX)

CREATE TABLE order_counters (
  type VARCHAR(20) PRIMARY KEY, -- 'stripe', 'square', 'manual'
  counter INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_counters IS 'Sequential counters for generating formatted order IDs';
COMMENT ON COLUMN order_counters.type IS 'Order source: stripe, square, or manual';
COMMENT ON COLUMN order_counters.counter IS 'Current counter value (increments atomically)';

-- Trigger to update timestamp
CREATE TRIGGER update_order_counters_updated_at BEFORE UPDATE ON order_counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP JOB FOR EXPIRED TOKENS
-- ============================================
-- Run this periodically (daily cron job) to remove expired tokens

-- DELETE FROM password_reset_tokens WHERE expires_at < NOW();
-- DELETE FROM email_verification_tokens WHERE expires_at < NOW();
-- DELETE FROM invoice_access_tokens WHERE expires_at < NOW();
-- DELETE FROM webhook_events WHERE expires_at < NOW();
