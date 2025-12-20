/**
 * Migrate Products Directly from Redis KV to Postgres
 *
 * This script reads products directly from Vercel KV and updates Postgres
 * with the exact data from Redis, ensuring perfect parity.
 */

import { kv } from '@vercel/kv';
import { db } from '../src/lib/db/client';
import { products } from '../src/lib/db/schema';

async function main() {
  console.log('🔄 Migrating products from Redis KV to Postgres...\n');

  try {
    // Get all product slugs from Redis index
    const slugs = await kv.smembers('products:index') as string[];

    if (!slugs || slugs.length === 0) {
      console.log('❌ No products found in Redis index!');
      return;
    }

    console.log(`📦 Found ${slugs.length} products in Redis\n`);

    let updated = 0;
    let failed = 0;

    for (const slug of slugs) {
      try {
        // Read product directly from Redis
        const redisProduct: any = await kv.get(`product:${slug}`);

        if (!redisProduct) {
          console.log(`⚠️  Product ${slug} not found in Redis, skipping`);
          continue;
        }

        // Convert price to cents
        const priceCents = Math.round(redisProduct.price * 100);

        // Convert materialCost to cents if it exists
        const materialCostCents = redisProduct.materialCost
          ? Math.round(redisProduct.materialCost * 100)
          : null;

        // Update Postgres with exact Redis data
        await db
          .insert(products)
          .values({
            slug: redisProduct.slug,
            name: redisProduct.name,
            description: redisProduct.seoDescription || null,
            priceCents,
            stock: redisProduct.stock ?? 0,
            sku: redisProduct.sku || null,
            stripePriceId: redisProduct.stripePriceId || null,
            squareCatalogId: redisProduct.squareCatalogId || null,
            squareVariantMapping: redisProduct.squareVariantMapping || null,
            imageUrl: redisProduct.image || null,
            images: redisProduct.images || null,
            bestSeller: redisProduct.bestSeller ?? false,
            youngDumb: redisProduct.youngDumb ?? false,
            alcoholType: redisProduct.alcoholType || null,
            materialCost: materialCostCents,
            visibleOnWebsite: redisProduct.visibleOnWebsite ?? true,
            variantConfig: redisProduct.variantConfig || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: products.slug,
            set: {
              name: redisProduct.name,
              description: redisProduct.seoDescription || null,
              priceCents,
              stock: redisProduct.stock ?? 0,
              sku: redisProduct.sku || null,
              stripePriceId: redisProduct.stripePriceId || null,
              squareCatalogId: redisProduct.squareCatalogId || null,
              squareVariantMapping: redisProduct.squareVariantMapping || null,
              imageUrl: redisProduct.image || null,
              images: redisProduct.images || null,
              bestSeller: redisProduct.bestSeller ?? false,
              youngDumb: redisProduct.youngDumb ?? false,
              alcoholType: redisProduct.alcoholType || null,
              materialCost: materialCostCents,
              visibleOnWebsite: redisProduct.visibleOnWebsite ?? true,
              variantConfig: redisProduct.variantConfig || null,
              updatedAt: new Date(),
            },
          });

        updated++;

        // Show what was migrated
        const alcoholTypeDisplay = redisProduct.alcoholType || 'None';
        const skuDisplay = redisProduct.sku || 'None';
        const squareIdDisplay = redisProduct.squareCatalogId || 'None';

        console.log(`✅ ${redisProduct.name}`);
        console.log(`   SKU: ${skuDisplay}`);
        console.log(`   Alcohol Type: ${alcoholTypeDisplay}`);
        console.log(`   Square ID: ${squareIdDisplay}`);
        console.log(`   Description: ${redisProduct.seoDescription ? 'Yes' : 'No'}`);
        console.log(`   Images: ${redisProduct.images ? 'Yes' : 'No'}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Failed to migrate ${slug}:`, error);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📦 Total: ${slugs.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
