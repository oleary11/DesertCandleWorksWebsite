# Performance Optimization Plan

## Current Performance Issues

You're experiencing slower load times with Postgres compared to Redis. Here are the key factors and optimizations:

## 1. Development vs Production

**YES** - Development is significantly slower:
- `npm run dev` uses Next.js dev server with:
  - Hot Module Replacement (HMR)
  - Non-optimized builds
  - Source maps
  - Additional debugging overhead

**Production will be much faster** with:
- Static page generation where possible
- Edge caching via Vercel
- Optimized JavaScript bundles
- HTTP/2 and compression

## 2. Implemented Optimizations

### Page-Level Caching (ISR - Incremental Static Regeneration)

Already implemented:
- **Home page**: `revalidate = 3600` (1 hour cache)
- **Shop page**: `revalidate = 30` (30 second cache)

### Missing Optimizations

The following pages don't have caching enabled:

1. **Product Detail Pages** (`/shop/[slug]`)
   - Should add `export const revalidate = 60` (1 minute)

2. **Young & Dumb Page** (`/shop/young-dumb`)
   - Should add `export const revalidate = 30`

## 3. Database Query Optimizations

### Current State
- Single table scans for products
- No indexes on frequently queried columns

### Recommended Indexes

Add these indexes to improve query performance:

```sql
-- Products table
CREATE INDEX IF NOT EXISTS idx_products_visible ON products(visible_on_website) WHERE visible_on_website = true;
CREATE INDEX IF NOT EXISTS idx_products_best_seller ON products(best_seller) WHERE best_seller = true;
CREATE INDEX IF NOT EXISTS idx_products_young_dumb ON products(young_dumb) WHERE young_dumb = true;
CREATE INDEX IF NOT EXISTS idx_products_alcohol_type ON products(alcohol_type) WHERE alcohol_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug); -- Already exists as PK but explicitly listing

-- Orders table
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Order items (for analytics)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_slug ON order_items(product_slug);
```

## 4. Neon Postgres Specific Optimizations

### Connection Pooling
Already using `@neondatabase/serverless` which includes:
- WebSocket connections for faster queries
- Automatic connection pooling
- Low-latency serverless architecture

### Neon-Specific Features
- **Autoscaling**: Neon automatically scales compute based on load
- **Branch databases**: Can use for development without affecting production
- **Read replicas**: Can add for heavy read workloads (optional, costs extra)

## 5. Next.js App Router Optimizations

### Parallel Data Fetching
Already implemented in shop page:
```typescript
const [allProducts, globalScents, alcoholTypes] = await Promise.all([
  listResolvedProducts(),
  getAllScents(),
  getAlcoholTypes(),
]);
```

### Recommended: Add to Product Detail Page
Similar parallel fetching should be added to individual product pages.

## 6. Quick Wins (Immediate Impact)

### A. Add Page Caching

Add to `src/app/shop/[slug]/page.tsx`:
```typescript
export const revalidate = 60; // Cache for 1 minute
```

Add to `src/app/shop/young-dumb/page.tsx`:
```typescript
export const revalidate = 30; // Cache for 30 seconds
```

### B. Create Database Indexes Script

Create a migration script to add performance indexes.

### C. Enable Vercel Edge Caching

In production, Vercel will automatically cache at the edge with the revalidate settings.

## 7. Monitoring Performance

### Test in Production
The real performance will only be visible in production (`npm run build && npm start` locally, or deployed to Vercel).

### Measure Improvements
- Use Chrome DevTools Performance tab
- Check Vercel Analytics (if enabled)
- Monitor Neon dashboard for query performance

## Expected Performance After Optimizations

- **Development**: Still slower due to HMR, but acceptable
- **Production**:
  - Initial page load: ~500ms - 1.5s (depending on network)
  - Cached pages: ~50-200ms
  - Database queries: ~10-50ms (Neon serverless)
  - Total TTFB: ~100-300ms

## Next Steps

1. Add revalidate to missing pages
2. Create and run database index migration
3. Test in production build locally
4. Deploy to Vercel and monitor
