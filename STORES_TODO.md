# Stores Migration Status

## ✅ Completed (Now using Postgres)

1. **userStore.ts** - Users, orders, points transactions, tokens ✅
2. **productsStore.ts** - Products and inventory ✅

## ⚠️ Remaining (Still using Redis)

These stores are less critical and can be migrated later or left in Redis:

3. **purchasesStore.ts** - Business expense tracking
   - Not user-facing
   - Can stay in Redis or migrate later

4. **promotionsStore.ts** - Discount codes
   - Low volume
   - Can stay in Redis for now

5. **refundStore.ts** - Refund management
   - Low volume
   - Can stay in Redis for now

6. **alcoholTypesStore.ts** - Metadata for scent categories
   - Already migrated (data is in Postgres)
   - Store file can be updated later

## 🎯 Recommendation

**You can deploy NOW with just userStore and productsStore migrated.**

The remaining stores handle:
- Admin-only features (purchases, refunds)
- Low-traffic features (promotions, metadata)

These can stay in Redis without issues, or you can migrate them later using the same pattern.

---

## If You Want to Migrate the Rest

I can help you migrate the remaining 4 stores. Each one follows the same pattern:

1. Import db and schema from `./db/client` and `./db/schema`
2. Replace Redis calls with Drizzle queries
3. Handle cents vs dollars conversion (for purchases)

**Estimated time:** 15-20 minutes for all 4

Let me know if you want me to finish them now, or if you want to deploy with just users and products migrated!
