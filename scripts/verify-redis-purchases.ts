/**
 * Verify Redis Purchase Data
 *
 * This script reads all purchases from Redis and calculates the totals
 * to verify what's actually stored there.
 */

import { kv } from '@vercel/kv';

async function main() {
  console.log('🔍 Verifying Redis purchase data...\n');

  try {
    // Get all purchase IDs from Redis index
    const purchaseIds = await kv.smembers('purchases:index') as string[];

    if (!purchaseIds || purchaseIds.length === 0) {
      console.log('❌ No purchases found in Redis index!');
      return;
    }

    console.log(`📦 Found ${purchaseIds.length} purchases in Redis\n`);

    let totalSpentCents = 0;
    let totalItems = 0;

    for (const id of purchaseIds) {
      const redisPurchase: any = await kv.get(`purchase:${id}`);

      if (!redisPurchase) {
        console.log(`⚠️  Purchase ${id} not found in Redis, skipping`);
        continue;
      }

      // Check if values are in dollars or cents
      const totalCents = redisPurchase.totalCents;
      const itemCount = redisPurchase.items.length;

      totalSpentCents += totalCents;
      totalItems += itemCount;

      console.log(`${redisPurchase.vendorName} - ${redisPurchase.purchaseDate}`);
      console.log(`  Total (raw): ${totalCents}`);
      console.log(`  Total (as dollars): $${(totalCents / 100).toFixed(2)}`);
      console.log(`  Total (as stored): $${totalCents.toFixed(2)}`);
      console.log(`  Items: ${itemCount}`);
      console.log('');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Redis Totals');
    console.log('='.repeat(60));
    console.log(`Total Purchases: ${purchaseIds.length}`);
    console.log(`Total Items: ${totalItems}`);
    console.log(`Total Spent (raw sum): ${totalSpentCents}`);
    console.log(`Total Spent (if cents): $${(totalSpentCents / 100).toFixed(2)}`);
    console.log(`Total Spent (if dollars): $${totalSpentCents.toFixed(2)}`);
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
