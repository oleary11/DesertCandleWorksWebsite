/**
 * Dump Raw Redis Product Data
 *
 * Reads products directly from Vercel KV to see the actual stored data
 */

import { kv } from '@vercel/kv';

async function main() {
  console.log('🔍 Dumping raw Redis product data...\n');

  // Get all product slugs from the index
  const slugs = await kv.smembers('products:index') as string[];

  if (!slugs || slugs.length === 0) {
    console.log('❌ No products found in Redis index!');
    return;
  }

  console.log(`📦 Found ${slugs.length} products in Redis\n`);

  // Get first 3 products in detail
  for (let i = 0; i < Math.min(3, slugs.length); i++) {
    const slug = slugs[i];
    const product = await kv.get(`product:${slug}`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Product ${i + 1}: ${slug}`);
    console.log('='.repeat(80));
    console.log(JSON.stringify(product, null, 2));
  }

  // Count field availability
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 Field Availability Summary');
  console.log(`${'='.repeat(80)}\n`);

  let fieldCounts = {
    sku: 0,
    squareCatalogId: 0,
    alcoholType: 0,
    seoDescription: 0,
    images: 0,
    image: 0,
    materialCost: 0,
    squareVariantMapping: 0,
  };

  for (const slug of slugs) {
    const product: any = await kv.get(`product:${slug}`);
    if (!product) continue;

    if (product.sku) fieldCounts.sku++;
    if (product.squareCatalogId) fieldCounts.squareCatalogId++;
    if (product.alcoholType) fieldCounts.alcoholType++;
    if (product.seoDescription) fieldCounts.seoDescription++;
    if (product.images && product.images.length > 0) fieldCounts.images++;
    if (product.image) fieldCounts.image++;
    if (product.materialCost) fieldCounts.materialCost++;
    if (product.squareVariantMapping) fieldCounts.squareVariantMapping++;
  }

  console.log(`Total Products: ${slugs.length}`);
  console.log(`\nFields present:`);
  console.log(`  sku: ${fieldCounts.sku}/${slugs.length}`);
  console.log(`  squareCatalogId: ${fieldCounts.squareCatalogId}/${slugs.length}`);
  console.log(`  alcoholType: ${fieldCounts.alcoholType}/${slugs.length}`);
  console.log(`  seoDescription: ${fieldCounts.seoDescription}/${slugs.length}`);
  console.log(`  images: ${fieldCounts.images}/${slugs.length}`);
  console.log(`  image (legacy): ${fieldCounts.image}/${slugs.length}`);
  console.log(`  materialCost: ${fieldCounts.materialCost}/${slugs.length}`);
  console.log(`  squareVariantMapping: ${fieldCounts.squareVariantMapping}/${slugs.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
