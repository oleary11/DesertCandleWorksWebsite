/**
 * Run ShipStation database migration
 * Adds weight, dimensions, and carrier tracking fields
 *
 * Usage: npx tsx src/scripts/run-shipstation-migration.ts
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('🔧 Running ShipStation database migration...\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    console.error('Make sure .env.local exists and contains DATABASE_URL');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    // Add weight and dimensions to products table
    console.log('Adding weight and dimensions columns to products table...');
    await sql`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS weight JSONB,
      ADD COLUMN IF NOT EXISTS dimensions JSONB
    `;
    console.log('✅ Products table updated\n');

    // Add carrier and ShipStation fields to orders table
    console.log('Adding carrier tracking columns to orders table...');
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS carrier_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS service_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS shipstation_order_id VARCHAR(50)
    `;
    console.log('✅ Orders table updated\n');

    // Verify columns were added
    console.log('Verifying migration...');
    const productsCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products'
      AND column_name IN ('weight', 'dimensions')
      ORDER BY column_name
    `;

    const ordersCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name IN ('carrier_code', 'service_code', 'shipstation_order_id')
      ORDER BY column_name
    `;

    console.log('\n📋 New columns in products table:');
    productsCheck.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n📋 New columns in orders table:');
    ordersCheck.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Restart your dev server');
    console.log('  2. The shop page should now load without errors');
    console.log('  3. Add product weights via admin panel or SQL');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify DATABASE_URL is set in .env.local');
    console.error('  2. Check database connection');
    console.error('  3. Ensure you have permission to ALTER tables');
    process.exit(1);
  }
}

runMigration();
