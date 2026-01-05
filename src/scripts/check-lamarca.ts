/**
 * Script to check La Marca product wick configuration
 */

import { sql } from '@/lib/db/client';

async function checkLaMarca() {
  console.log('🔍 Checking La Marca product...\n');

  try {
    const results = await sql`
      SELECT slug, name, variant_config
      FROM products
      WHERE slug ILIKE '%lamarca%' OR name ILIKE '%lamarca%'
    `;

    if (results.length === 0) {
      console.log('❌ No La Marca product found');
      process.exit(1);
    }

    for (const product of results) {
      console.log(`📦 Product: ${product.name} (${product.slug})\n`);
      console.log('Variant Config:');
      console.log(JSON.stringify(product.variant_config, null, 2));

      if (product.variant_config?.wickTypes) {
        console.log('\n🔧 Wick Types:');
        product.variant_config.wickTypes.forEach((wick: { id: string; name: string }, index: number) => {
          console.log(`  ${index + 1}. ${wick.name} (ID: ${wick.id})`);
        });

        // Check for duplicates
        const wickIds = product.variant_config.wickTypes.map((w: { id: string }) => w.id);
        const uniqueIds = new Set(wickIds);

        if (wickIds.length !== uniqueIds.size) {
          console.log('\n⚠️  DUPLICATE WICK IDS FOUND!');
          const duplicates = wickIds.filter((id: string, index: number) => wickIds.indexOf(id) !== index);
          console.log('Duplicate IDs:', [...new Set(duplicates)]);
        } else {
          console.log('\n✅ No duplicate wick IDs');
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLaMarca();
