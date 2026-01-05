/**
 * Script to find products with duplicate wick types in their variant config
 */

import { sql } from '@/lib/db/client';

interface Product {
  slug: string;
  name: string;
  variant_config: {
    wickTypes?: Array<{ id: string; name: string }>;
  } | null;
}

async function findDuplicateWicks() {
  console.log('🔍 Searching for products with duplicate wick types...\n');

  try {
    // Query all products with variant_config
    const products = await sql`
      SELECT slug, name, variant_config
      FROM products
      WHERE variant_config IS NOT NULL
      ORDER BY name
    ` as unknown as Product[];

    console.log(`Found ${products.length} products with variant configs\n`);

    const productsWithDuplicates: Array<{
      slug: string;
      name: string;
      wickTypes: Array<{ id: string; name: string }>;
      duplicates: string[];
    }> = [];

    for (const product of products) {
      const wickTypes = product.variant_config?.wickTypes;

      if (!wickTypes || !Array.isArray(wickTypes)) {
        continue;
      }

      // Check for duplicate wick IDs
      const wickIdCounts = new Map<string, number>();
      const wickNameMap = new Map<string, string>();

      for (const wick of wickTypes) {
        wickIdCounts.set(wick.id, (wickIdCounts.get(wick.id) || 0) + 1);
        wickNameMap.set(wick.id, wick.name);
      }

      // Find duplicates
      const duplicateIds = Array.from(wickIdCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([id]) => id);

      if (duplicateIds.length > 0) {
        productsWithDuplicates.push({
          slug: product.slug,
          name: product.name,
          wickTypes,
          duplicates: duplicateIds.map(id => `${wickNameMap.get(id)} (${id})`),
        });
      }
    }

    if (productsWithDuplicates.length === 0) {
      console.log('✅ No products with duplicate wick types found!');
    } else {
      console.log(`❌ Found ${productsWithDuplicates.length} product(s) with duplicate wick types:\n`);

      for (const product of productsWithDuplicates) {
        console.log(`📦 ${product.name} (${product.slug})`);
        console.log(`   Total wick types: ${product.wickTypes.length}`);
        console.log(`   Duplicates: ${product.duplicates.join(', ')}`);
        console.log(`   All wick types:`);

        const wickCounts = new Map<string, number>();
        for (const wick of product.wickTypes) {
          const key = `${wick.name} (${wick.id})`;
          wickCounts.set(key, (wickCounts.get(key) || 0) + 1);
        }

        for (const [wickName, count] of wickCounts.entries()) {
          console.log(`     - ${wickName}${count > 1 ? ` [DUPLICATE x${count}]` : ''}`);
        }
        console.log();
      }

      console.log('\n💡 To fix these duplicates, you can:');
      console.log('   1. Go to the Admin Products page');
      console.log('   2. Edit the affected product(s)');
      console.log('   3. Remove duplicate wick types from the configuration');
      console.log('   4. Click "Publish Changes"');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error querying database:', error);
    process.exit(1);
  }
}

findDuplicateWicks();
