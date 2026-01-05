/**
 * Test script to verify random order ID generation
 */

import { generateOrderId } from '@/lib/userStore';

async function testOrderIdGeneration() {
  console.log('🧪 Testing random order ID generation...\n');

  try {
    // Generate 10 IDs for each type to verify randomness
    console.log('Generating 10 Stripe order IDs:');
    for (let i = 0; i < 10; i++) {
      const id = await generateOrderId('stripe');
      console.log(`  ${i + 1}. ${id}`);
    }

    console.log('\nGenerating 10 Square order IDs:');
    for (let i = 0; i < 10; i++) {
      const id = await generateOrderId('square');
      console.log(`  ${i + 1}. ${id}`);
    }

    console.log('\nGenerating 10 Manual order IDs:');
    for (let i = 0; i < 10; i++) {
      const id = await generateOrderId('manual');
      console.log(`  ${i + 1}. ${id}`);
    }

    console.log('\n✅ Order ID generation successful!');
    console.log('\nVerify that:');
    console.log('  1. IDs are in format: ST#####, SQ#####, MS#####');
    console.log('  2. Numbers are random (not sequential)');
    console.log('  3. All numbers are 5 digits');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testOrderIdGeneration();
