/**
 * Setup Script: Subscribe to ShipStation SHIP_NOTIFY Webhook
 *
 * Run this script AFTER deploying the webhook endpoint to production:
 * npx tsx src/scripts/setup-shipstation-webhook.ts
 *
 * This will register your webhook URL with ShipStation so you receive
 * tracking number updates when labels are created.
 */

import { subscribeToWebhook, listWebhooks } from '@/lib/shipstation';

async function setupWebhook() {
  console.log('🚢 ShipStation Webhook Setup\n');

  // Get production URL from environment
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.desertcandleworks.com';
  const webhookUrl = `${baseUrl}/api/shipstation/webhook`;

  console.log(`Webhook URL: ${webhookUrl}\n`);

  try {
    // First, list existing webhooks to avoid duplicates
    console.log('📋 Checking existing webhooks...');
    const existing = await listWebhooks();

    if (existing.webhooks && existing.webhooks.length > 0) {
      console.log(`\nFound ${existing.webhooks.length} existing webhook(s):`);
      for (const webhook of existing.webhooks) {
        console.log(`  - ${webhook.event}: ${webhook.target_url} (ID: ${webhook.id})`);

        if (webhook.target_url === webhookUrl && webhook.event === 'SHIP_NOTIFY') {
          console.log('\n✅ SHIP_NOTIFY webhook already configured for this URL!');
          console.log('   No action needed.');
          return;
        }
      }
    } else {
      console.log('No existing webhooks found.');
    }

    // Subscribe to SHIP_NOTIFY webhook
    console.log(`\n📡 Subscribing to SHIP_NOTIFY webhook...`);
    const result = await subscribeToWebhook(webhookUrl, 'SHIP_NOTIFY');

    console.log(`\n✅ SUCCESS! Webhook subscribed:`);
    console.log(`   Event: ${result.event}`);
    console.log(`   URL: ${result.target_url}`);
    console.log(`   Webhook ID: ${result.id}`);

    console.log(`\n🎉 ShipStation webhook setup complete!`);
    console.log(`\nNext steps:`);
    console.log(`  1. Create a test label in ShipStation dashboard`);
    console.log(`  2. Check your logs to verify webhook is received`);
    console.log(`  3. Verify tracking number appears in your order`);

  } catch (error) {
    console.error('\n❌ Error setting up webhook:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET are set in .env.local');
    console.error('  2. Ensure your webhook endpoint is deployed and accessible');
    console.error('  3. Check ShipStation API credentials are valid');
    process.exit(1);
  }
}

setupWebhook();
