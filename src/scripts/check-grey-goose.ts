/**
 * Check Grey Goose variant configuration and scents
 * Run with: npx tsx src/scripts/check-grey-goose.ts
 */

import { db } from '@/lib/db/client';
import { products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getScentsForProduct, getAllScents } from '@/lib/scents';
import { generateVariants } from '@/lib/products';
import { getTotalStockForProduct } from '@/lib/productsStore';

async function checkGreyGoose() {
  console.log('Checking Grey Goose Vodka Candle...\n');

  // Get product from database
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.slug, 'grey-goose-vodka-candle'))
    .limit(1);

  if (!product) {
    console.log('❌ Product not found in database!');
    return;
  }

  console.log('✅ Product found');
  console.log(`Name: ${product.name}`);
  console.log(`Slug: ${product.slug}`);
  console.log('');

  if (!product.variantConfig) {
    console.log('❌ No variant config found');
    return;
  }

  console.log('Variant Configuration:');
  console.log(JSON.stringify(product.variantConfig, null, 2));
  console.log('');

  // Get all scents
  const allScents = await getAllScents();
  console.log(`\nAll scents in system: ${allScents.length}`);

  // Find warm-leather scent
  const warmLeather = allScents.find(s => s.id === 'warm-leather');
  if (warmLeather) {
    console.log('\n"warm-leather" scent configuration:');
    console.log(JSON.stringify(warmLeather, null, 2));
  } else {
    console.log('\n❌ "warm-leather" scent not found in system!');
  }

  // Get scents available for this product
  const scentsForProduct = await getScentsForProduct('grey-goose-vodka-candle');
  console.log(`\nScents available for Grey Goose: ${scentsForProduct.length}`);
  scentsForProduct.forEach(s => {
    console.log(`  - ${s.id} (${s.name}) ${s.limited ? '[LIMITED]' : ''}`);
  });

  // Check if warm-leather is in the list
  const hasWarmLeather = scentsForProduct.some(s => s.id === 'warm-leather');
  console.log(`\n"warm-leather" available for Grey Goose: ${hasWarmLeather ? '✅ YES' : '❌ NO'}`);

  // Generate variants
  const variants = generateVariants(product as any, scentsForProduct);
  console.log(`\nGenerated variants: ${variants.length}`);
  variants.forEach(v => {
    console.log(`  - ${v.id}: stock=${v.stock} (wick=${v.wickType}, scent=${v.scent})`);
  });

  // Get total stock
  const totalStock = await getTotalStockForProduct(product as any);
  console.log(`\nTotal stock for product: ${totalStock}`);

  // Check specific variant
  const warmLeatherVariant = variants.find(v => v.scent === 'warm-leather');
  if (warmLeatherVariant) {
    console.log(`\n✅ "warm-leather" variant found: ${warmLeatherVariant.id} with stock=${warmLeatherVariant.stock}`);
  } else {
    console.log(`\n❌ "warm-leather" variant NOT in generated variants`);
  }
}

checkGreyGoose()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
