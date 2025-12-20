/**
 * Verify Products Migration Script
 *
 * Checks if all product fields were properly migrated
 */

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('🔍 Verifying product migration...\n');

  // Get a sample of products with their fields
  const products = await sql`
    SELECT
      slug,
      name,
      sku,
      square_catalog_id,
      alcohol_type,
      description,
      images,
      material_cost
    FROM products
    LIMIT 10
  `;

  console.log('📋 Sample Products:\n');

  let missingFields = {
    sku: 0,
    squareCatalogId: 0,
    alcoholType: 0,
    description: 0,
    images: 0,
  };

  for (const product of products) {
    console.log(`\n${product.name} (${product.slug}):`);
    console.log(`  SKU: ${product.sku || '❌ MISSING'}`);
    console.log(`  Square Catalog ID: ${product.square_catalog_id || '❌ MISSING'}`);
    console.log(`  Alcohol Type: ${product.alcohol_type || '❌ MISSING'}`);
    console.log(`  Description: ${product.description ? '✅' : '❌ MISSING'}`);
    console.log(`  Images: ${product.images ? '✅' : '❌ MISSING'}`);
    console.log(`  Material Cost: ${product.material_cost ? `$${(product.material_cost / 100).toFixed(2)}` : 'Not set'}`);

    if (!product.sku) missingFields.sku++;
    if (!product.square_catalog_id) missingFields.squareCatalogId++;
    if (!product.alcohol_type) missingFields.alcoholType++;
    if (!product.description) missingFields.description++;
    if (!product.images) missingFields.images++;
  }

  console.log('\n\n📊 Missing Field Summary:');
  console.log(`  SKU: ${missingFields.sku}/${products.length} missing`);
  console.log(`  Square Catalog ID: ${missingFields.squareCatalogId}/${products.length} missing`);
  console.log(`  Alcohol Type: ${missingFields.alcoholType}/${products.length} missing`);
  console.log(`  Description: ${missingFields.description}/${products.length} missing`);
  console.log(`  Images: ${missingFields.images}/${products.length} missing`);

  // Get total count
  const totalResult = await sql`SELECT COUNT(*) as count FROM products`;
  const total = Number(totalResult[0].count);
  console.log(`\n📦 Total products in database: ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
