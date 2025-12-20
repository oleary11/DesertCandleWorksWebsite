/**
 * Migrate Promotions Directly from Redis KV to Postgres
 *
 * This script reads promotions directly from Vercel KV and migrates them to Postgres
 */

import { kv } from '@vercel/kv';
import { db } from '../src/lib/db/client';
import { promotions } from '../src/lib/db/schema';

async function main() {
  console.log('🔄 Migrating promotions from Redis KV to Postgres...\n');

  try {
    // Get all promotion codes from Redis index
    const codes = await kv.smembers('promotions:index') as string[];

    if (!codes || codes.length === 0) {
      console.log('❌ No promotions found in Redis index!');
      return;
    }

    console.log(`📦 Found ${codes.length} promotions in Redis\n`);

    let migrated = 0;
    let failed = 0;

    for (const code of codes) {
      try {
        // Read promotion directly from Redis
        const redisPromo: any = await kv.get(`promotion:${code}`);

        if (!redisPromo) {
          console.log(`⚠️  Promotion ${code} not found in Redis, skipping`);
          continue;
        }

        // Map promotion type to database discount type
        type DiscountType = "percentage" | "fixed_amount";
        const discountType: DiscountType =
          redisPromo.type === "percentage" ? "percentage" : "fixed_amount";

        const discountValue =
          redisPromo.type === "percentage"
            ? redisPromo.discountPercent ?? 0
            : redisPromo.discountAmountCents ?? 0;

        // Insert promotion
        await db
          .insert(promotions)
          .values({
            id: redisPromo.id,
            code: redisPromo.code,
            description: redisPromo.description || null,
            discountType,
            discountValue,
            minPurchaseCents: redisPromo.minOrderAmountCents ?? 0,
            maxRedemptions: redisPromo.maxRedemptions || null,
            currentRedemptions: redisPromo.currentRedemptions || 0,
            active: redisPromo.active ?? true,
            startsAt: redisPromo.startsAt ? new Date(redisPromo.startsAt) : null,
            expiresAt: redisPromo.expiresAt ? new Date(redisPromo.expiresAt) : null,
            createdAt: redisPromo.createdAt ? new Date(redisPromo.createdAt) : new Date(),
            updatedAt: redisPromo.updatedAt ? new Date(redisPromo.updatedAt) : new Date(),
          })
          .onConflictDoUpdate({
            target: promotions.code,
            set: {
              description: redisPromo.description || null,
              discountType,
              discountValue,
              minPurchaseCents: redisPromo.minOrderAmountCents ?? 0,
              maxRedemptions: redisPromo.maxRedemptions || null,
              currentRedemptions: redisPromo.currentRedemptions || 0,
              active: redisPromo.active ?? true,
              startsAt: redisPromo.startsAt ? new Date(redisPromo.startsAt) : null,
              expiresAt: redisPromo.expiresAt ? new Date(redisPromo.expiresAt) : null,
              updatedAt: redisPromo.updatedAt ? new Date(redisPromo.updatedAt) : new Date(),
            },
          });

        migrated++;

        console.log(`✅ ${redisPromo.code}`);
        console.log(`   Type: ${redisPromo.type}`);
        console.log(`   Discount: ${discountType === 'percentage' ? `${discountValue}%` : `$${(discountValue / 100).toFixed(2)}`}`);
        console.log(`   Active: ${redisPromo.active ?? true}`);
        console.log(`   Redemptions: ${redisPromo.currentRedemptions || 0}${redisPromo.maxRedemptions ? `/${redisPromo.maxRedemptions}` : ''}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Failed to migrate promotion ${code}:`, error);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Promotions Migrated: ${migrated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total in Redis: ${codes.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
