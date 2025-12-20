/**
 * Cleanup Duplicate Order Items Script
 *
 * This script removes duplicate order items that were created during multiple migration runs.
 * It keeps only the first occurrence of each unique (orderId, productSlug, variantId, priceCents, quantity) combination.
 *
 * Run with: npx tsx scripts/cleanup-duplicate-order-items.ts
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('🧹 Starting cleanup of duplicate order items...\n');

  try {
    // Count total order items before cleanup
    const beforeResult = await sql`SELECT COUNT(*)::int as count FROM order_items`;
    const totalBefore = beforeResult[0].count;
    console.log(`📊 Total order items before cleanup: ${totalBefore}`);

    // Find and delete duplicates, keeping only the first (lowest id) for each unique combination
    await sql`
      DELETE FROM order_items
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM order_items
        GROUP BY order_id, product_slug, COALESCE(variant_id, ''), price_cents, quantity
      )
    `;

    // Count total order items after cleanup
    const afterResult = await sql`SELECT COUNT(*)::int as count FROM order_items`;
    const totalAfter = afterResult[0].count;

    const deletedCount = totalBefore - totalAfter;

    console.log(`✅ Cleanup complete!`);
    console.log(`📊 Total order items after cleanup: ${totalAfter}`);
    console.log(`🗑️  Deleted ${deletedCount} duplicate order items`);

    if (deletedCount > 0) {
      console.log(`\n✨ Your order items are now deduplicated!`);
    } else {
      console.log(`\n✨ No duplicates found - your data is clean!`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
