/**
 * Script to find products with orphaned variant data (variants that reference wick types not in wickTypes array)
 */

import { sql } from '@/lib/db/client';

interface Product {
  slug: string;
  name: string;
  variant_config: {
    wickTypes?: Array<{ id: string; name: string }>;
    variantData?: Record<string, { stock?: number; [key: string]: unknown }>;
  } | null;
}

async function findOrphanedVariants() {
  console.log('🔍 Searching for products with orphaned variant data...\n');

  try {
    const products = await sql<Product[]>`
      SELECT slug, name, variant_config
      FROM products
      WHERE variant_config IS NOT NULL
      ORDER BY name
    `;

    console.log(`Found ${products.length} products with variant configs\n`);

    const productsWithOrphans: Array<{
      slug: string;
      name: string;
      validWickIds: string[];
      orphanedVariants: string[];
    }> = [];

    for (const product of products) {
      const variantConfig = product.variant_config;

      if (!variantConfig?.wickTypes || !variantConfig?.variantData) {
        continue;
      }

      // Get valid wick IDs from wickTypes array
      const validWickIds = new Set(variantConfig.wickTypes.map(w => w.id));

      // Check all variants in variantData
      const orphanedVariants: string[] = [];

      for (const variantId of Object.keys(variantConfig.variantData)) {
        // Variant ID format is typically: {wickId}-{scentId}
        const wickId = variantId.split('-').slice(0, -1).join('-') || variantId;

        // Check if the wick ID used in this variant is in the wickTypes array
        if (!validWickIds.has(wickId)) {
          orphanedVariants.push(variantId);
        }
      }

      if (orphanedVariants.length > 0) {
        productsWithOrphans.push({
          slug: product.slug,
          name: product.name,
          validWickIds: Array.from(validWickIds),
          orphanedVariants,
        });
      }
    }

    if (productsWithOrphans.length === 0) {
      console.log('✅ No products with orphaned variant data found!');
    } else {
      console.log(`❌ Found ${productsWithOrphans.length} product(s) with orphaned variant data:\n`);

      for (const product of productsWithOrphans) {
        console.log(`📦 ${product.name} (${product.slug})`);
        console.log(`   Valid wick IDs: ${product.validWickIds.join(', ')}`);
        console.log(`   Orphaned variants (${product.orphanedVariants.length}):`);

        for (const variantId of product.orphanedVariants) {
          const parts = variantId.split('-');
          const possibleWickId = parts.slice(0, -1).join('-');
          const scentId = parts[parts.length - 1];
          console.log(`     - ${variantId}`);
          console.log(`       (Wick: ${possibleWickId}, Scent: ${scentId})`);
        }
        console.log();
      }

      console.log('\n💡 These orphaned variants may indicate:');
      console.log('   1. Wick types that were removed but variant data was not cleaned up');
      console.log('   2. Data migration issues');
      console.log('   3. Manual edits that removed wick types from the wickTypes array');
      console.log('\nTo clean up, you can either:');
      console.log('   - Add the missing wick types back to the product');
      console.log('   - Remove the orphaned variant data entries');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error querying database:', error);
    process.exit(1);
  }
}

findOrphanedVariants();
