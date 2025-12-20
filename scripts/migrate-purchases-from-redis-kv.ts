/**
 * Migrate Purchases Directly from Redis KV to Postgres
 *
 * This script reads purchases directly from Vercel KV and updates Postgres
 * to ensure all purchases (including the missing October one) are migrated.
 */

import { kv } from '@vercel/kv';
import { db, sql } from '../src/lib/db/client';
import { purchases, purchaseItems } from '../src/lib/db/schema';

async function main() {
  console.log('🔄 Migrating purchases from Redis KV to Postgres...\n');

  try {
    // Clear existing purchases and items (cascading delete will handle items)
    console.log('🧹 Clearing existing purchases from Postgres...');
    await sql`DELETE FROM purchases`;
    console.log('✅ Cleared all existing purchases\n');

    // Get all purchase IDs from Redis index
    const purchaseIds = await kv.smembers('purchases:index') as string[];

    if (!purchaseIds || purchaseIds.length === 0) {
      console.log('❌ No purchases found in Redis index!');
      return;
    }

    console.log(`📦 Found ${purchaseIds.length} purchases in Redis\n`);

    let updated = 0;
    let failed = 0;
    let totalSpentCents = 0;
    let totalItems = 0;

    for (const id of purchaseIds) {
      try {
        // Read purchase directly from Redis
        const redisPurchase: any = await kv.get(`purchase:${id}`);

        if (!redisPurchase) {
          console.log(`⚠️  Purchase ${id} not found in Redis, skipping`);
          continue;
        }

        // Convert values to cents if they're stored as dollars
        // If the value is already an integer (no decimal), assume it's cents
        // If it has decimals, it's dollars and needs conversion
        const ensureCents = (value: number): number => {
          // Check if the value has decimals (is a float)
          if (value % 1 !== 0) {
            // It's dollars, convert to cents
            return Math.round(value * 100);
          }
          // It's already an integer, assume it's cents
          return value;
        };

        const subtotalCents = ensureCents(redisPurchase.subtotalCents);
        const shippingCents = ensureCents(redisPurchase.shippingCents);
        const taxCents = ensureCents(redisPurchase.taxCents);
        const totalCents = ensureCents(redisPurchase.totalCents);

        // Insert purchase
        await db
          .insert(purchases)
          .values({
            id: redisPurchase.id,
            vendorName: redisPurchase.vendorName,
            purchaseDate: redisPurchase.purchaseDate,
            subtotalCents,
            shippingCents,
            taxCents,
            totalCents,
            receiptImageUrl: redisPurchase.receiptImageUrl || null,
            notes: redisPurchase.notes || null,
            createdAt: new Date(redisPurchase.createdAt),
            updatedAt: new Date(redisPurchase.updatedAt),
          });

        // Insert purchase items
        for (const item of redisPurchase.items) {
          const itemUnitCostCents = ensureCents(item.unitCostCents);

          // Ensure quantity is an integer (some old data might have decimals)
          const itemQuantity = Math.round(item.quantity);

          await db
            .insert(purchaseItems)
            .values({
              purchaseId: redisPurchase.id,
              name: item.name,
              quantity: itemQuantity,
              unitCostCents: itemUnitCostCents,
              category: item.category,
              notes: item.notes || null,
              createdAt: new Date(redisPurchase.createdAt),
            });

          totalItems++;
        }

        totalSpentCents += totalCents;
        updated++;

        console.log(`✅ ${redisPurchase.vendorName} - ${redisPurchase.purchaseDate}`);
        console.log(`   Total: $${(totalCents / 100).toFixed(2)}`);
        console.log(`   Items: ${redisPurchase.items.length}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Failed to migrate purchase ${id}:`, error);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Purchases Updated: ${updated}`);
    console.log(`📦 Total Items: ${totalItems}`);
    console.log(`💰 Total Spent: $${(totalSpentCents / 100).toFixed(2)}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total Purchases in Redis: ${purchaseIds.length}`);
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
