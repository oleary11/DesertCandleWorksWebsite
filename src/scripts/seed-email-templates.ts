/**
 * Seed default email templates into the database
 * Run with: npx tsx src/scripts/seed-email-templates.ts
 */

import { db } from '@/lib/db/client';
import { emailTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const defaultTemplates = [
  {
    name: 'Shipping Notification',
    subject: 'Your Order Has Shipped!',
    message: `Hi there,

Great news! Your order #[Order ID] has been shipped and is on its way to you.

Tracking Number: [Tracking Number]

Your candles were hand-poured with care in Scottsdale, Arizona. We hope you enjoy them!

If you have any questions about your delivery, please don't hesitate to contact us.

Best regards,
Desert Candle Works Team`,
    isDefault: true,
  },
  {
    name: 'Delivery Notification',
    subject: 'Your Order Has Been Delivered!',
    message: `Hi there,

Your Desert Candle Works order #[Order ID] has been successfully delivered!

Tracking Number: [Tracking Number]

Enjoy Your Candles!
We hope you love your hand-poured candles! Each one is crafted with care right here in Scottsdale, Arizona.

Care Tips:
- Trim wick to 1/4" before each use
- Burn for 2-3 hours at a time for best results
- Keep away from drafts and flammable materials

Love your candles? We'd appreciate it if you could leave us a review!
Leave a Review: https://g.page/r/CQcLSwY5Vml0EBM/review

You can also tag us on social media @desertcandleworks

Best regards,
Desert Candle Works Team`,
    isDefault: true,
  },
];

async function seedTemplates() {
  console.log('Seeding email templates...');

  for (const template of defaultTemplates) {
    // Check if template already exists
    const existing = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.name, template.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`✓ Template "${template.name}" already exists, skipping`);
      continue;
    }

    // Insert template
    await db.insert(emailTemplates).values(template);
    console.log(`✓ Created template: "${template.name}"`);
  }

  console.log('\n✅ Done! Email templates seeded successfully.');
}

seedTemplates()
  .catch((error) => {
    console.error('Error seeding templates:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
