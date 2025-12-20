/**
 * Fix Products from Static Data
 *
 * Updates Postgres products with the correct data from the static products.ts file
 */

import { db } from '../src/lib/db/client';
import { products as productsTable } from '../src/lib/db/schema';
import { products as staticProducts } from '../src/lib/products';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🔧 Fixing products from static data...\n');

  let updated = 0;
  let notFound = 0;

  for (const product of staticProducts) {
    try {
      const materialCostCents = product.materialCost
        ? Math.round(product.materialCost * 100)
        : null;

      await db
        .update(productsTable)
        .set({
          sku: product.sku || null,
          description: product.seoDescription || null,
          squareCatalogId: product.squareCatalogId || null,
          squareVariantMapping: product.squareVariantMapping as any || null,
          images: product.images as any || null,
          alcoholType: product.alcoholType || null,
          materialCost: materialCostCents,
          visibleOnWebsite: product.visibleOnWebsite ?? true,
        })
        .where(eq(productsTable.slug, product.slug));

      updated++;
      console.log(`✅ Updated ${product.slug} (${product.sku || 'no SKU'})`);
    } catch (error) {
      console.error(`❌ Failed to update ${product.slug}:`, error);
      notFound++;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${notFound}`);
  console.log(`  Total: ${staticProducts.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
