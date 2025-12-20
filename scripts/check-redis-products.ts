/**
 * Check Redis Product Data
 *
 * Inspects what fields are actually stored in Redis products
 */

import { listProducts } from '../src/lib/productsStore';

async function main() {
  console.log('🔍 Checking Redis product data...\n');

  const products = await listProducts();

  if (products.length === 0) {
    console.log('❌ No products found in Redis!');
    return;
  }

  // Check first product in detail
  const firstProduct = products[0];
  console.log('📦 First Product (Full Data):');
  console.log(JSON.stringify(firstProduct, null, 2));

  console.log('\n\n📊 Field availability across all products:\n');

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

  for (const product of products) {
    if (product.sku) fieldCounts.sku++;
    if (product.squareCatalogId) fieldCounts.squareCatalogId++;
    if (product.alcoholType) fieldCounts.alcoholType++;
    if (product.seoDescription) fieldCounts.seoDescription++;
    if (product.images && product.images.length > 0) fieldCounts.images++;
    if (product.image) fieldCounts.image++;
    if ((product as any).materialCost) fieldCounts.materialCost++;
    if (product.squareVariantMapping) fieldCounts.squareVariantMapping++;
  }

  console.log(`Total Products: ${products.length}`);
  console.log(`\nFields present:`);
  console.log(`  sku: ${fieldCounts.sku}/${products.length}`);
  console.log(`  squareCatalogId: ${fieldCounts.squareCatalogId}/${products.length}`);
  console.log(`  alcoholType: ${fieldCounts.alcoholType}/${products.length}`);
  console.log(`  seoDescription: ${fieldCounts.seoDescription}/${products.length}`);
  console.log(`  images: ${fieldCounts.images}/${products.length}`);
  console.log(`  image (legacy): ${fieldCounts.image}/${products.length}`);
  console.log(`  materialCost: ${fieldCounts.materialCost}/${products.length}`);
  console.log(`  squareVariantMapping: ${fieldCounts.squareVariantMapping}/${products.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
