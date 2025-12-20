/**
 * Check Specific Redis Purchase
 *
 * This script checks the raw data for a specific purchase in Redis
 */

import { kv } from '@vercel/kv';

async function main() {
  const purchaseId = '7a0c764d-d20e-42b7-91d6-9ec2128e7593'; // The $1987.53 Amazon purchase

  console.log(`🔍 Checking Redis purchase ${purchaseId}...\n`);

  try {
    const purchase: any = await kv.get(`purchase:${purchaseId}`);

    if (!purchase) {
      console.log('❌ Purchase not found in Redis!');
      return;
    }

    console.log('📦 Raw Redis data:');
    console.log(JSON.stringify(purchase, null, 2));

    console.log('\n💰 Financial breakdown:');
    console.log(`  Subtotal (raw): ${purchase.subtotalCents}`);
    console.log(`  Shipping (raw): ${purchase.shippingCents}`);
    console.log(`  Tax (raw): ${purchase.taxCents}`);
    console.log(`  Total (raw): ${purchase.totalCents}`);
    console.log('');
    console.log(`  If these are cents:`);
    console.log(`    Subtotal: $${(purchase.subtotalCents / 100).toFixed(2)}`);
    console.log(`    Shipping: $${(purchase.shippingCents / 100).toFixed(2)}`);
    console.log(`    Tax: $${(purchase.taxCents / 100).toFixed(2)}`);
    console.log(`    Total: $${(purchase.totalCents / 100).toFixed(2)}`);
    console.log('');
    console.log(`  If these are dollars:`);
    console.log(`    Subtotal: $${purchase.subtotalCents.toFixed(2)}`);
    console.log(`    Shipping: $${purchase.shippingCents.toFixed(2)}`);
    console.log(`    Tax: $${purchase.taxCents.toFixed(2)}`);
    console.log(`    Total: $${purchase.totalCents.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
