/**
 * Check Promotions in Postgres
 *
 * This script checks what promotions are currently in Postgres
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('🔍 Checking promotions in Postgres...\n');

  try {
    // Count total promotions
    const totalResult = await sql`SELECT COUNT(*)::int as count FROM promotions`;
    const total = totalResult[0].count;
    console.log(`📊 Total promotions in Postgres: ${total}\n`);

    if (total > 0) {
      // List all promotions
      console.log('📋 All promotions:');
      const allPromotions = await sql`
        SELECT code, description, discount_type, discount_value, active, expires_at
        FROM promotions
        ORDER BY code
      `;

      for (const promo of allPromotions) {
        console.log(`  Code: ${promo.code}`);
        console.log(`  Description: ${promo.description || 'None'}`);
        console.log(`  Type: ${promo.discount_type}`);
        console.log(`  Value: ${promo.discount_value}`);
        console.log(`  Active: ${promo.active}`);
        console.log(`  Expires: ${promo.expires_at || 'Never'}`);
        console.log('');
      }
    } else {
      console.log('❌ No promotions found in Postgres!');
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
