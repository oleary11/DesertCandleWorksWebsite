# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Pre-Deploy Checklist (IMPORTANT)

ESLint and TypeScript checks are **disabled during Vercel builds** for faster deploys. This means errors won't be caught at build time.

**After completing any code changes, always ask the user:**
> "Would you like me to run lint and type checks before you deploy?"

If yes, run:
```bash
npm run lint && npx tsc --noEmit
```

This ensures no lint errors or type errors slip into production.

## Project Overview

Desert Candle Works website - a Next.js 15 e-commerce site for hand-poured candles in upcycled bottles. The site features a storefront, admin panel for inventory management, and Stripe integration for payments.

**Tech Stack:**
- Next.js 15.5.4 (App Router, Turbopack)
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4.x
- Vercel KV (Redis) via @vercel/kv
- Vercel Blob Storage via @vercel/blob
- Stripe for payments

## Common Commands

### Development
```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build with Turbopack
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Architecture

### Product Data Flow (Hybrid Static + Live)

The codebase uses a **two-tier product data system**:

1. **Static Seed** (`src/lib/products.ts`): 15 hardcoded products with default stock=0
2. **Live Store** (`src/lib/productsStore.ts`): Redis-backed store for runtime product mutations

**Resolution Strategy** (`src/lib/resolvedProducts.ts`):
- `listResolvedProducts()` merges Redis data (if exists) with static fallback
- Static products auto-seed into Redis on first mutation (stock change, admin edit)
- Admin changes always write to Redis via `upsertProduct()`

**Key Functions:**
- `productsStore.upsertProduct()` - Create/update product in Redis
- `productsStore.setStock()` / `incrStock()` - Inventory management (auto-seeds from static)
- `productsStore.listProducts()` - Fetch all Redis products
- `resolvedProducts.listResolvedProducts()` - Unified view (Redis + static fallback)

### Admin System

**Authentication**: Cookie-based session system using Redis
- Middleware (`src/middleware.ts`) protects `/admin/*` and `/api/admin/*` routes
- Login checks password against `ADMIN_PASSWORD` env var
- Sessions stored as `admin:session:{token}` in Redis with TTL
- Functions in `src/lib/adminSession.ts`: `createAdminSession()`, `destroyAdminSession()`, `isAdminAuthed()`

**Admin UI** (`src/app/admin/page.tsx`):
- Draft-based editing: changes are staged locally, then published via API calls
- Stock controls: +/- buttons and direct input
- Image uploads to Vercel Blob Storage via `/api/admin/upload`
- Auto-incrementing SKU generation (DCW-0001, DCW-0002, etc.)
- Slug validation: lowercase alphanumeric + hyphens, auto-generated from product name

**Admin API Routes** (`src/app/api/admin/`):
- `POST /api/admin/products` - Create new product
- `PATCH /api/admin/products/[slug]` - Update existing product
- `DELETE /api/admin/products/[slug]` - Delete product
- `GET /api/admin/products` - List all products (uses `listResolvedProducts()`)
- `GET /api/admin/inventory` - Stock levels only
- `POST /api/admin/upload` - Image upload to Vercel Blob
- `POST /api/admin/auto-map-square-variants` - Auto-generate Square variant mappings
  - `forceRemap: true` - Recreate Square product with all current website variants (use when adding new scents/wicks)
- `POST /api/admin/sync-square-stock` - Sync inventory levels to Square POS

### Square POS Integration

**Setup**:
- Products can be created on Square via "Create Square Product" button in admin
- Square products are created with all current variants (wick types × scents)
- Variant mappings are stored in `squareVariantMapping` field

**Syncing Variants**:
- **"Sync Stock to Square"** - Syncs inventory levels only (creates mapping if missing)
- **"Remap Variants"** - Recreates Square product with all current website variants
  - Use this when you add new scents or wick types to an existing product
  - Deletes old Square product and creates new one with updated variations
  - Prompts to sync stock after remapping

**Webhook Handler** (`src/app/api/square/webhook/route.ts`):
- Listens for `payment.updated` events from Square POS
- Double idempotency check: event ID + payment ID (prevents duplicate orders)
- Automatically decrements stock when sales are made in-store
- Creates order records with "square" payment method
- Maps Square variation IDs to website variants via `squareVariantMapping`

**Environment Variables**:
- `SQUARE_ACCESS_TOKEN` - Square API access token
- `SQUARE_LOCATION_ID` - Square location ID for inventory management
- `SQUARE_ENVIRONMENT` - "production" or "sandbox"
- `SQUARE_WEBHOOK_SIGNATURE_KEY` - Webhook signature verification key

### Stripe Integration

**Checkout Flow**:
1. Frontend sends `lineItems` array to `POST /api/checkout`
2. Creates Stripe Checkout session with success/cancel URLs
3. Returns JSON with session URL or redirects (based on content-type)

**Webhook** (`src/app/api/stripe/webhook/route.ts`):
- Listens for `checkout.session.completed` events
- Verifies signature using `STRIPE_WEBHOOK_SECRET`
- Decrements stock via `incrStock(slug, -qty)` for each purchased item
- Uses price-to-slug mapping from `src/lib/pricemap.ts`

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if using Stripe Elements)

### Routing Structure

- `/` - Homepage
- `/shop` - Product catalog (grid view with filters)
- `/shop/[slug]` - Individual product detail pages
- `/about` - About page
- `/contact` - Contact form
- `/policies` - Policies page
- `/admin` - Admin dashboard (protected)
- `/admin/login` - Admin login page

### Image Handling

- **Static images**: `/images/*.png` in `public/images/`
- **Uploaded images**: Vercel Blob Storage URLs via admin upload
- **Next.js Image component**: Configured for `**.public.blob.vercel-storage.com` remote pattern
- Image qualities: [75, 90]

### Styling

- Custom CSS variables in `src/app/globals.css` for theming
- Utility classes: `.btn`, `.card`, `.input`, `.textarea`, `.badge`
- Responsive design with mobile-first approach
- Admin tables switch to card layout on mobile (`md:` breakpoint)

### Redis Key Patterns

- `product:{slug}` - Individual product data
- `products:index` - Set of all product slugs
- `admin:session:{token}` - Admin session tokens
- `stock:{slug}` - Legacy stock keys (not used in current version, see `productsStore.ts`)

## Important Implementation Notes

### When Adding New Products

1. Either add to `src/lib/products.ts` static array (for seed data)
2. Or create via admin UI (writes directly to Redis)
3. Must include `stripePriceId` for Stripe checkout to work
4. Slug must match regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`

### When Modifying Product Schema

Update type definition in THREE places:
1. `src/lib/products.ts` - `Product` type
2. `src/lib/productsStore.ts` - `Product` type (should match)
3. Admin UI form fields in `src/app/admin/page.tsx`

### Stock Management

- All stock mutations go through `productsStore.ts` functions
- Negative stock is prevented (throws error)
- Stock operations auto-seed static products into Redis on first modification
- Admin stock changes are staged locally until "Publish" is clicked

### SEO

- Dynamic sitemap: `src/app/sitemap.ts`
- Dynamic robots.txt: `src/app/robots.ts`
- Each product has `seoDescription` field for meta tags
- Non-www to www redirect configured in `next.config.ts`

### Type Safety

- TypeScript strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- No implicit any, strict null checks
- Runtime type guards for API boundaries (e.g., `isLineItemArray()`)

### Environment Setup

Required environment variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_PASSWORD`
- `KV_REST_API_URL` (Vercel KV)
- `KV_REST_API_TOKEN` (Vercel KV)
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
- `NEXT_PUBLIC_BASE_URL` (for Stripe redirect URLs)
- `ADMIN_SESSION_TTL_SECONDS` (optional, default 604800 = 7 days)
