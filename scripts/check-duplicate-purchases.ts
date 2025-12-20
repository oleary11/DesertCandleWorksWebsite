/**
 * Check for Duplicate Purchases
 *
 * This script checks if there are duplicate purchases in Postgres
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('🔍 Checking for duplicate purchases...\n');

  try {
    // Check for duplicate purchase IDs
    const duplicates = await sql`
      SELECT id, vendor_name, purchase_date, total_cents, COUNT(*) as count
      FROM purchases
      GROUP BY id, vendor_name, purchase_date, total_cents
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate purchase IDs:\n`);
      for (const dup of duplicates) {
        console.log(`  ${dup.vendor_name} - ${dup.purchase_date}: $${(Number(dup.total_cents) / 100).toFixed(2)} (appears ${dup.count} times)`);
      }
    } else {
      console.log('✅ No duplicate purchase IDs found\n');
    }

    // Count total purchases
    const totalResult = await sql`SELECT COUNT(*)::int as count FROM purchases`;
    const total = totalResult[0].count;
    console.log(`📊 Total purchases in Postgres: ${total}`);

    // Calculate total spent
    const spentResult = await sql`SELECT SUM(total_cents)::bigint as total FROM purchases`;
    const totalSpent = Number(spentResult[0].total);
    console.log(`💰 Total spent: $${(totalSpent / 100).toFixed(2)}`);

    // List all purchases
    console.log('\n📋 All purchases:');
    const allPurchases = await sql`
      SELECT id, vendor_name, purchase_date, total_cents
      FROM purchases
      ORDER BY purchase_date, vendor_name
    `;

    for (const p of allPurchases) {
      console.log(`  ${p.purchase_date} - ${p.vendor_name}: $${(Number(p.total_cents) / 100).toFixed(2)} (ID: ${p.id})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
