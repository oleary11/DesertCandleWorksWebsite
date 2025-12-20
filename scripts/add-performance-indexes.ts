/**
 * Add Performance Indexes to Postgres
 *
 * This script adds database indexes to improve query performance
 * for frequently accessed columns.
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('📊 Adding performance indexes to Postgres...\n');

  try {
    // Products table indexes
    console.log('Creating indexes on products table...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_products_visible
      ON products(visible_on_website)
      WHERE visible_on_website = true
    `;
    console.log('✅ Created index on products.visible_on_website');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_products_best_seller
      ON products(best_seller)
      WHERE best_seller = true
    `;
    console.log('✅ Created index on products.best_seller');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_products_young_dumb
      ON products(young_dumb)
      WHERE young_dumb = true
    `;
    console.log('✅ Created index on products.young_dumb');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_products_alcohol_type
      ON products(alcohol_type)
      WHERE alcohol_type IS NOT NULL
    `;
    console.log('✅ Created index on products.alcohol_type');

    // Orders table indexes
    console.log('\nCreating indexes on orders table...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_email
      ON orders(email)
    `;
    console.log('✅ Created index on orders.email');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at
      ON orders(created_at DESC)
    `;
    console.log('✅ Created index on orders.created_at');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_status
      ON orders(status)
    `;
    console.log('✅ Created index on orders.status');

    // Order items indexes
    console.log('\nCreating indexes on order_items table...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id)
    `;
    console.log('✅ Created index on order_items.order_id');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_order_items_product_slug
      ON order_items(product_slug)
    `;
    console.log('✅ Created index on order_items.product_slug');

    // Purchases indexes
    console.log('\nCreating indexes on purchases table...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_purchases_vendor_name
      ON purchases(vendor_name)
    `;
    console.log('✅ Created index on purchases.vendor_name');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date
      ON purchases(purchase_date DESC)
    `;
    console.log('✅ Created index on purchases.purchase_date');

    // Purchase items indexes
    console.log('\nCreating indexes on purchase_items table...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id
      ON purchase_items(purchase_id)
    `;
    console.log('✅ Created index on purchase_items.purchase_id');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_purchase_items_category
      ON purchase_items(category)
    `;
    console.log('✅ Created index on purchase_items.category');

    // Promotions indexes
    console.log('\nCreating indexes on promotions table...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_promotions_active
      ON promotions(active)
      WHERE active = true
    `;
    console.log('✅ Created index on promotions.active');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_promotions_expires_at
      ON promotions(expires_at)
      WHERE expires_at IS NOT NULL
    `;
    console.log('✅ Created index on promotions.expires_at');

    console.log('\n' + '='.repeat(60));
    console.log('✨ All performance indexes created successfully!');
    console.log('='.repeat(60));
    console.log('\n💡 These indexes will improve query performance for:');
    console.log('  - Product listing and filtering');
    console.log('  - Order lookups and analytics');
    console.log('  - Purchase tracking and reports');
    console.log('  - Promotion validation');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
