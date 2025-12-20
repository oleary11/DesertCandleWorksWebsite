/**
 * Cleanup Duplicate Purchase Items Script
 *
 * This script removes duplicate purchase items that were created during multiple migration runs.
 * It keeps only the first occurrence of each unique purchase item.
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('🧹 Starting cleanup of duplicate purchase items...\n');

  try {
    // Count total purchase items before cleanup
    const beforeResult = await sql`SELECT COUNT(*)::int as count FROM purchase_items`;
    const totalBefore = beforeResult[0].count;
    console.log(`📊 Total purchase items before cleanup: ${totalBefore}`);

    // Count total purchases
    const purchasesResult = await sql`SELECT COUNT(*)::int as count FROM purchases`;
    const totalPurchases = purchasesResult[0].count;
    console.log(`📦 Total purchases: ${totalPurchases}`);

    // Find and delete duplicates, keeping only the first (lowest id) for each unique combination
    // We group by all fields except id and createdAt to identify duplicates
    await sql`
      DELETE FROM purchase_items
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM purchase_items
        GROUP BY purchase_id, name, quantity, unit_cost_cents, category, COALESCE(notes, '')
      )
    `;

    // Count total purchase items after cleanup
    const afterResult = await sql`SELECT COUNT(*)::int as count FROM purchase_items`;
    const totalAfter = afterResult[0].count;

    const deletedCount = totalBefore - totalAfter;

    console.log(`\n✅ Cleanup complete!`);
    console.log(`📊 Total purchase items after cleanup: ${totalAfter}`);
    console.log(`🗑️  Deleted ${deletedCount} duplicate purchase items`);

    // Show some statistics
    const avgItemsPerPurchase = totalPurchases > 0 ? (totalAfter / totalPurchases).toFixed(1) : 0;
    console.log(`📈 Average items per purchase: ${avgItemsPerPurchase}`);

    if (deletedCount > 0) {
      console.log(`\n✨ Your purchase items are now deduplicated!`);
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
