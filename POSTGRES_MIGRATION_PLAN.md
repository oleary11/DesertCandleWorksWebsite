# Redis to Postgres Migration Plan

## Executive Summary

This document outlines a comprehensive migration strategy from Redis (Upstash/Vercel KV) to Postgres (Neon/Supabase) for Desert Candle Works e-commerce platform.

**Current State:** All data stored in Redis with JSON values and manual indexing
**Target State:** Postgres as primary database, Redis for caching only (or removed)
**Migration Approach:** Dual-write pattern with gradual rollover

---

## 1. Current Redis Data Structure Analysis

### Entities Stored in Redis

1. **Users** (`user:{id}`, `user:email:{email}`)
   - User accounts with password hashes
   - Email-to-ID mappings for authentication
   - Email verification status
   - Points balance (denormalized)

2. **Orders** (`order:{id}`)
   - Customer orders (both guest and authenticated)
   - Shipping information and tracking
   - Order items with product details
   - Points earned/redeemed
   - Payment method (for manual sales)

3. **Products** (`product:{slug}`)
   - Product catalog with variants
   - Stock levels (critical for inventory)
   - Pricing and metadata
   - Variant configurations (wicks, scents)

4. **Purchases** (`purchase:{id}`)
   - Business expense tracking
   - Vendor management
   - Item allocations with shipping/tax

5. **Promotions** (`promotion:{id}`)
   - Discount codes
   - Redemption tracking
   - Usage limits

6. **Refunds** (`refund:{id}`)
   - Refund requests and processing
   - Stripe refund IDs
   - Inventory restoration tracking

7. **Points Transactions** (`points:transaction:{id}`)
   - Points history for rewards program
   - Earn/redeem/adjustment records

8. **Alcohol Types** (`alcohol-type:{id}`)
   - Scent categorization metadata
   - Sort ordering

9. **Session Management**
   - Admin sessions (`admin:session:{token}`)
   - User sessions (`session:{token}`)
   - Password reset tokens (`password:reset:{token}`)
   - Email verification tokens (`email:verify:{token}`)
   - Invoice access tokens (`invoice:token:{token}`)

10. **Indexes** (Redis Sets/Lists)
    - `users:index` (set of all user IDs)
    - `orders:index` (set of all order IDs)
    - `orders:user:{userId}` (list of user's orders)
    - `orders:guest:{email}` (list of guest orders by email)
    - `points:user:{userId}` (list of point transactions)
    - `purchases:index`, `purchases:vendor:{name}`, `purchases:date:{yearMonth}`
    - `promotions:index`
    - `refunds:index`, `order:{orderId}:refunds`
    - `products:index`

11. **Other Redis Usage**
    - Webhook event deduplication (`webhook:event:{id}`)
    - Rate limiting (from rateLimit.ts)
    - Scents, containers, calculator settings
    - Admin logs, 2FA secrets
    - Mobile upload tokens

---

## 2. Proposed Postgres Schema

```sql
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

-- Index for fast email lookups (authentication)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ============================================
-- ORDERS
-- ============================================

CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE shipping_status AS ENUM ('pending', 'shipped', 'delivered');
CREATE TYPE payment_method_type AS ENUM ('stripe', 'cash', 'card', 'other');

CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY, -- Stripe checkout session ID
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT false,

  -- Pricing
  total_cents INTEGER NOT NULL,
  product_subtotal_cents INTEGER,
  shipping_cents INTEGER,
  tax_cents INTEGER,

  -- Points & Promotions
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  promotion_id VARCHAR(100),

  -- Payment
  payment_method payment_method_type,
  notes TEXT,

  -- Status
  status order_status NOT NULL DEFAULT 'pending',
  shipping_status shipping_status DEFAULT 'pending',

  -- Shipping Info
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

-- Indexes for common queries
CREATE INDEX idx_orders_user_id ON orders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_shipping_status ON orders(shipping_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_tracking ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- Order items (denormalized from JSON array)
CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_slug VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_id VARCHAR(100),
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
  variant_config JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_best_seller ON products(best_seller) WHERE best_seller = true;
CREATE INDEX idx_products_stock ON products(stock) WHERE stock > 0;

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

CREATE INDEX idx_points_transactions_user_id ON points_transactions(user_id, created_at DESC);
CREATE INDEX idx_points_transactions_order_id ON points_transactions(order_id) WHERE order_id IS NOT NULL;

-- ============================================
-- PURCHASES (Business Expenses)
-- ============================================

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(255) NOT NULL,
  purchase_date DATE NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  receipt_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_vendor ON purchases(vendor_name);
CREATE INDEX idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX idx_purchases_created_at ON purchases(created_at DESC);

CREATE TABLE purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_cents INTEGER NOT NULL,
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
  discount_value INTEGER NOT NULL, -- percentage (0-100) or cents
  min_purchase_cents INTEGER DEFAULT 0,
  max_redemptions INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  points_to_deduct INTEGER DEFAULT 0,
  processed_by VARCHAR(100), -- admin user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

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
  refund_amount_cents INTEGER NOT NULL
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

CREATE INDEX idx_alcohol_types_sort ON alcohol_types(sort_order, name);

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
-- WEBHOOK EVENT TRACKING
-- ============================================

CREATE TABLE webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_webhook_events_expires ON webhook_events(expires_at);

-- ============================================
-- UPDATED_AT TRIGGER
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

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alcohol_types_updated_at BEFORE UPDATE ON alcohol_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Data Access Layer (DAL) Interface

### Strategy: Repository Pattern with Adapter

Create an abstraction layer that can work with either Redis or Postgres, allowing gradual migration.

```typescript
// src/lib/db/types.ts

export interface IUserRepository {
  createUser(email: string, password: string, firstName: string, lastName: string): Promise<User>;
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUserProfile(userId: string, updates: Partial<User>): Promise<User>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  listAllUsers(): Promise<User[]>;
}

export interface IOrderRepository {
  createOrder(data: CreateOrderData): Promise<Order>;
  getOrderById(orderId: string): Promise<Order | null>;
  getUserOrders(userId: string, limit?: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  updateOrderShipping(orderId: string, trackingNumber: string, status: ShippingStatus): Promise<Order>;
  completeOrder(orderId: string): Promise<void>;
  deleteOrder(orderId: string): Promise<void>;
}

export interface IProductRepository {
  listProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  upsertProduct(product: Product): Promise<Product>;
  deleteProduct(slug: string): Promise<void>;
  setStock(slug: string, value: number): Promise<number>;
  setVariantStock(slug: string, variantId: string, value: number): Promise<Product>;
}

export interface IPointsRepository {
  addPoints(userId: string, amount: number, type: TransactionType, description: string, orderId?: string): Promise<PointsTransaction>;
  getUserPointsTransactions(userId: string, limit?: number): Promise<PointsTransaction[]>;
  redeemPoints(userId: string, amount: number, description: string): Promise<PointsTransaction>;
  deductPoints(userId: string, amount: number, description: string): Promise<PointsTransaction>;
}

// ... similar interfaces for Purchases, Promotions, Refunds, etc.
```

### Implementation Structure

```
src/lib/db/
├── types.ts                    # Repository interfaces
├── repositories/
│   ├── redis/
│   │   ├── userRepository.ts   # Redis implementation
│   │   ├── orderRepository.ts
│   │   └── ...
│   └── postgres/
│       ├── userRepository.ts   # Postgres implementation
│       ├── orderRepository.ts
│       └── ...
├── index.ts                    # Factory to select implementation
└── client.ts                   # Postgres client setup
```

---

## 4. Safe Migration Strategy

### Phase 1: Preparation (Week 1)
1. **Set up Postgres database**
   - Create Neon or Supabase account
   - Run schema creation scripts
   - Set up connection pooling
   - Add environment variables

2. **Implement Postgres DAL**
   - Create all repository implementations
   - Write comprehensive unit tests
   - Test in local development environment

3. **Add feature flag**
   ```typescript
   const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
   ```

### Phase 2: Dual-Write (Week 2-3)
1. **Implement dual-write layer**
   - Write to both Redis and Postgres
   - Read from Redis (existing behavior)
   - Log any write failures

   ```typescript
   export async function createOrder(data: CreateOrderData): Promise<Order> {
     // Primary: Redis (current behavior)
     const order = await redisOrderRepo.createOrder(data);

     // Secondary: Postgres (dual-write)
     try {
       await postgresOrderRepo.createOrder(data);
     } catch (error) {
       console.error('[Dual-Write] Failed to write to Postgres:', error);
       // Don't fail the request - just log
     }

     return order;
   }
   ```

2. **Deploy dual-write to production**
3. **Monitor for write errors**
4. **Let run for 1-2 weeks** to build up Postgres data

### Phase 3: Data Migration (Week 3-4)
1. **Create migration script**
   ```bash
   npm run migrate:redis-to-postgres
   ```

2. **Migrate historical data** (in order of dependencies):
   - Users
   - Products
   - Alcohol Types
   - Orders & Order Items
   - Points Transactions
   - Purchases & Purchase Items
   - Promotions
   - Refunds & Refund Items
   - Tokens (if not expired)

3. **Verify data integrity**
   - Count records in both systems
   - Spot-check critical records
   - Validate relationships

### Phase 4: Gradual Read Migration (Week 4-5)
1. **Start reading from Postgres with Redis fallback**
   ```typescript
   export async function getUserById(userId: string): Promise<User | null> {
     if (USE_POSTGRES) {
       const pgUser = await postgresUserRepo.getUserById(userId);
       if (pgUser) return pgUser;

       // Fallback to Redis if not found
       console.warn('[Migration] User not found in Postgres, trying Redis');
       return redisUserRepo.getUserById(userId);
     }

     return redisUserRepo.getUserById(userId);
   }
   ```

2. **Enable Postgres reads for non-critical features first**:
   - Admin analytics
   - Purchase tracking
   - Alcohol types

3. **Gradually enable for critical features**:
   - Product catalog (read-only)
   - User profiles
   - Order history
   - Points transactions
   - Shopping cart checkout (last!)

4. **Monitor performance and errors**
   - Set up alerts for query timeouts
   - Track database connection pool usage
   - Monitor API response times

### Phase 5: Cut Over (Week 5-6)
1. **Enable full Postgres mode**
   ```
   USE_POSTGRES=true
   ```

2. **Stop dual-writes to Redis**
3. **Keep Redis for caching only**:
   - Session data (short-lived)
   - Rate limiting
   - Webhook deduplication (TTL-based)

4. **Monitor closely for 48 hours**

### Phase 6: Cleanup (Week 6+)
1. **Remove Redis data access code** (or keep as archive)
2. **Optimize Postgres queries** based on production metrics
3. **Add database backups** (Neon/Supabase have this built-in)
4. **Update documentation**

---

## 5. Breaking Change Risks

### HIGH RISK ⚠️

1. **Stock Management Race Conditions**
   - **Risk**: Concurrent stock updates during checkout
   - **Current**: Redis atomic operations
   - **Solution**: Use Postgres transactions with row-level locking
   ```sql
   BEGIN;
   SELECT stock FROM products WHERE slug = $1 FOR UPDATE;
   UPDATE products SET stock = stock - $2 WHERE slug = $1;
   COMMIT;
   ```

2. **Session Data Loss**
   - **Risk**: Users logged out during migration
   - **Solution**: Keep sessions in Redis, only migrate persistent data

3. **Order ID Conflicts**
   - **Risk**: Stripe creates same session ID during migration
   - **Solution**: Use `ON CONFLICT DO UPDATE` in Postgres

4. **Points Balance Inconsistency**
   - **Risk**: Denormalized points balance out of sync with transactions
   - **Solution**: Recalculate from transactions during migration:
   ```sql
   UPDATE users u SET points = (
     SELECT COALESCE(SUM(amount), 0)
     FROM points_transactions
     WHERE user_id = u.id
   );
   ```

### MEDIUM RISK ⚙️

5. **Performance Degradation**
   - **Risk**: Postgres queries slower than Redis
   - **Solution**:
     - Add appropriate indexes (already in schema)
     - Use connection pooling
     - Implement query result caching
     - Consider read replicas for analytics

6. **Guest Order Linking**
   - **Risk**: Guest orders not properly linked when user creates account
   - **Solution**: Maintain `linkGuestOrdersToUser()` logic with email index

7. **Variant Stock Tracking**
   - **Risk**: JSONB variant config harder to update atomically
   - **Solution**: Consider normalizing to separate `product_variants` table

### LOW RISK ✓

8. **Token Expiration**
   - **Current**: Redis TTL auto-deletes
   - **Solution**: Add cleanup cron job or use expires_at filters

9. **Webhook Deduplication**
   - **Current**: Redis TTL (7 days)
   - **Solution**: Keep this in Redis OR add Postgres cleanup job

10. **Rate Limiting**
    - **Current**: Redis counters with TTL
    - **Solution**: Keep in Redis (perfect use case for caching layer)

---

## 6. What to Keep in Redis (Caching Layer)

After migration, Redis should only handle ephemeral data:

1. ✅ **Session tokens** (admin & user sessions)
2. ✅ **Rate limiting counters** (TTL-based)
3. ✅ **Webhook event deduplication** (TTL-based, 7 days)
4. ✅ **OAuth tokens** (USPS, etc.) with expiration
5. ✅ **Query result caching** (optional performance optimization)
6. ✅ **Real-time inventory locks** (during checkout, 15-min TTL)

**Total Redis Usage After Migration:** ~90% reduction

---

## 7. Recommended Technology Stack

### Option 1: Neon (Recommended)
- ✅ Serverless Postgres with autoscaling
- ✅ Generous free tier (0.5GB storage, 191 hours compute/month)
- ✅ Built-in connection pooling
- ✅ Instant branching for testing
- ✅ Point-in-time recovery
- ✅ Low latency from Vercel
- **Cost:** Free tier likely sufficient, paid starts at $19/mo

### Option 2: Supabase
- ✅ Postgres + Auth + Realtime + Storage
- ✅ Good free tier (500MB storage, 2GB data transfer)
- ✅ Built-in auth (could replace custom user management)
- ✅ Realtime subscriptions (for admin dashboard)
- **Cost:** Free tier likely sufficient, paid starts at $25/mo

### ORM Choice: **Drizzle** (Recommended)
```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);

// Type-safe queries with zero runtime overhead
const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
```

**Why not Prisma?**
- Drizzle is lighter and faster for serverless
- Better TypeScript inference
- No schema drift issues
- Easier migration from raw SQL

---

## 8. Implementation Checklist

### Pre-Migration
- [ ] Set up Neon/Supabase account
- [ ] Create database and run schema
- [ ] Add `DATABASE_URL` to environment
- [ ] Install `@neondatabase/serverless` and `drizzle-orm`
- [ ] Create Drizzle schema definitions
- [ ] Implement Postgres repositories
- [ ] Write unit tests for all repositories
- [ ] Test locally with test database

### Dual-Write Phase
- [ ] Add `USE_POSTGRES` feature flag
- [ ] Implement dual-write wrappers
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Let run for 1-2 weeks

### Migration Phase
- [ ] Create migration script
- [ ] Test migration on copy of production data
- [ ] Run migration in production (off-peak hours)
- [ ] Verify data integrity
- [ ] Keep Redis data as backup

### Read Migration Phase
- [ ] Enable Postgres reads for admin features
- [ ] Enable for product catalog
- [ ] Enable for user profiles
- [ ] Enable for order history
- [ ] Enable for checkout (final step!)
- [ ] Monitor performance at each step

### Cut Over
- [ ] Set `USE_POSTGRES=true` globally
- [ ] Stop dual-writes
- [ ] Monitor for 48 hours
- [ ] Verify all features work

### Post-Migration
- [ ] Remove old Redis DAL code
- [ ] Optimize slow queries
- [ ] Set up automated backups
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## 9. Rollback Plan

If issues arise during migration:

### Immediate Rollback (< 1 hour)
```bash
# Disable Postgres reads
USE_POSTGRES=false

# All traffic back to Redis
# No data loss since dual-write continues
```

### Partial Rollback (By Feature)
```typescript
// Disable Postgres for specific features
const USE_POSTGRES_ORDERS = false;
const USE_POSTGRES_USERS = true; // Keep what works
```

### Full Rollback (Nuclear Option)
1. Stop dual-writes
2. Keep using Redis exclusively
3. Debug Postgres issues offline
4. Try again when ready

**Key Safety:** During dual-write phase, Redis is always source of truth, so rollback is safe.

---

## 10. Monitoring & Alerts

Set up alerts for:
- Database connection pool exhaustion
- Query timeouts (> 5 seconds)
- Failed dual-writes
- Stock inconsistencies (Redis vs Postgres)
- User complaints about data missing

Use Vercel Analytics + Sentry for error tracking.

---

## Questions to Answer Before Starting

1. **Which Postgres provider?** Neon or Supabase?
2. **When to migrate?** Low-traffic period (early morning, weekday)
3. **How to handle downtime?** Maintenance window or zero-downtime dual-write?
4. **Keep Redis forever?** Or remove after migration?
5. **Budget for Postgres?** Free tier sufficient?

---

## Estimated Timeline

- **Weeks 1-2:** Setup + DAL implementation + testing
- **Weeks 3-4:** Dual-write deployment + data migration
- **Weeks 5-6:** Gradual read migration + monitoring
- **Week 7+:** Cut over + cleanup

**Total:** ~7-8 weeks for safe, zero-downtime migration

**Fast-track option:** 2-3 weeks if you accept brief downtime and skip dual-write phase
