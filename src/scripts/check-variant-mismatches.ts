/**
 * Check all products for variant ID mismatches
 * Run with: npx tsx src/scripts/check-variant-mismatches.ts
 */

import { db } from '@/lib/db/client';
import { products } from '@/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

async function checkVariantMismatches() {
  console.log('Checking for variant ID mismatches...\n');

  const prods = await db.select().from(products).where(isNotNull(products.variantConfig));
  console.log(`Total products with variants: ${prods.length}\n`);

  const issues: Array<{
    name: string;
    slug: string;
    wickTypes: string[];
    mismatchedVariants: string[];
    allVariants: string[];
    stockInMismatched: number;
  }> = [];

  for (const p of prods) {
    const vc = p.variantConfig as any;
    if (!vc || !vc.wickTypes || !vc.variantData) continue;

    const wickIds = new Set(vc.wickTypes.map((w: any) => w.id));
    const variantIds = Object.keys(vc.variantData);

    const mismatched = variantIds.filter((vid) => {
      let matchesAnyWick = false;
      for (const wickId of wickIds) {
        if (vid.startsWith(wickId + '-')) {
          matchesAnyWick = true;
          break;
        }
      }
      return !matchesAnyWick;
    });

    if (mismatched.length > 0) {
      // Calculate stock in mismatched variants
      let stockInMismatched = 0;
      for (const vid of mismatched) {
        stockInMismatched += vc.variantData[vid]?.stock ?? 0;
      }

      issues.push({
        name: p.name,
        slug: p.slug,
        wickTypes: Array.from(wickIds) as string[],
        mismatchedVariants: mismatched,
        allVariants: variantIds,
        stockInMismatched,
      });
    }
  }

  console.log(`Products with mismatched variant IDs: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('✅ No variant ID mismatches found!');
    return;
  }

  console.log('❌ Issues found:\n');
  issues.forEach((i) => {
    console.log(`${i.name} (${i.slug}):`);
    console.log(`  Wick types: [${i.wickTypes.join(', ')}]`);
    console.log(`  Mismatched variants (${i.mismatchedVariants.length}): [${i.mismatchedVariants.join(', ')}]`);
    console.log(`  Stock in mismatched variants: ${i.stockInMismatched}`);
    console.log(`  All variants: [${i.allVariants.join(', ')}]`);
    console.log('');
  });

  console.log('\n📊 Summary:');
  console.log(`  Total products checked: ${prods.length}`);
  console.log(`  Products with issues: ${issues.length}`);
  console.log(`  Total stock hidden: ${issues.reduce((sum, i) => sum + i.stockInMismatched, 0)}`);
}

checkVariantMismatches()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
