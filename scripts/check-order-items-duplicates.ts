/**
 * Check Order Items for Duplicates
 *
 * This script checks if order items are duplicated in Postgres
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('🔍 Checking for duplicate order items...\n');

  try {
    // Count total order items
    const totalResult = await sql`SELECT COUNT(*)::int as count FROM order_items`;
    const total = totalResult[0].count;
    console.log(`📊 Total order items: ${total}`);

    // Count unique order items (by all fields except id)
    const uniqueResult = await sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT DISTINCT order_id, product_slug, COALESCE(variant_id, ''), price_cents, quantity
        FROM order_items
      ) as unique_items
    `;
    const unique = uniqueResult[0].count;
    console.log(`📊 Unique order items: ${unique}`);
    console.log(`📊 Duplicates: ${total - unique}\n`);

    // Find specific duplicates
    const duplicates = await sql`
      SELECT
        order_id,
        product_slug,
        COALESCE(variant_id, '') as variant_id,
        price_cents,
        quantity,
        COUNT(*) as count
      FROM order_items
      GROUP BY order_id, product_slug, COALESCE(variant_id, ''), price_cents, quantity
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;

    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} groups of duplicated items (showing first 10):\n`);
      for (const dup of duplicates) {
        console.log(`  Order: ${dup.order_id}`);
        console.log(`  Product: ${dup.product_slug}`);
        console.log(`  Variant: ${dup.variant_id || 'none'}`);
        console.log(`  Price: $${(Number(dup.price_cents) / 100).toFixed(2)}`);
        console.log(`  Quantity: ${dup.quantity}`);
        console.log(`  Appears: ${dup.count} times`);
        console.log('');
      }
    } else {
      console.log('✅ No duplicates found');
    }

    // Sample some order items to see the pattern
    console.log('\n📋 Sample order items (first 10):');
    const samples = await sql`
      SELECT id, order_id, product_slug, variant_id, quantity, price_cents
      FROM order_items
      ORDER BY id
      LIMIT 10
    `;

    for (const item of samples) {
      console.log(`  ID: ${item.id} | Order: ${item.order_id} | Product: ${item.product_slug} | Qty: ${item.quantity} | Price: $${(Number(item.price_cents) / 100).toFixed(2)}`);
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
