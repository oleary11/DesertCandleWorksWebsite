import { db } from './src/lib/db/client';
import { orders, orderItems } from './src/lib/db/schema';
import { desc, gte, sql } from 'drizzle-orm';

async function checkDuplicates() {
  // Get date from command line arg or use today
  const dateArg = process.argv[2];
  const checkDate = dateArg ? new Date(dateArg) : new Date();
  // Set to start of day
  checkDate.setHours(0, 0, 0, 0);

  const dateStr = checkDate.toISOString().split('T')[0];
  const results = await db.select().from(orders).where(gte(orders.createdAt, checkDate)).orderBy(desc(orders.createdAt));

  console.log(`\nTotal orders since ${dateStr}: ${results.length}\n`);

  // Group by Square payment ID to find duplicates
  const squarePaymentGroups: Record<string, any[]> = {};

  for (const order of results) {
    if (order.notes && order.notes.includes('Square Payment ID:')) {
      const match = order.notes.match(/Square Payment ID: ([\w-]+)/);
      if (match) {
        const paymentId = match[1];
        if (!squarePaymentGroups[paymentId]) {
          squarePaymentGroups[paymentId] = [];
        }
        squarePaymentGroups[paymentId].push(order);
      }
    }
  }

  console.log('Checking for duplicates...\n');

  const duplicateGroups = Object.entries(squarePaymentGroups).filter(([_, orders]) => orders.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('No duplicates found!');
  } else {
    console.log(`Found ${duplicateGroups.length} Square payments with duplicate orders:\n`);

    for (const [paymentId, dupOrders] of duplicateGroups) {
      console.log(`Square Payment ID: ${paymentId} - ${dupOrders.length} duplicate orders:`);
      for (const order of dupOrders) {
        console.log(`  Order ID: ${order.id} | Total: $${(order.totalCents / 100).toFixed(2)} | Created: ${order.createdAt.toISOString()}`);
      }
      console.log('');
    }
  }

  // Get order items to check for identical products
  console.log('\nChecking order items for first duplicate group...\n');
  if (duplicateGroups.length > 0) {
    const [paymentId, dupOrders] = duplicateGroups[0];
    for (const order of dupOrders) {
      const items = await db.select().from(orderItems).where(sql`${orderItems.orderId} = ${order.id}`);
      console.log(`Order ${order.id}:`);
      items.forEach(item => {
        console.log(`  - ${item.productName} x${item.quantity} @ $${(item.priceCents / 100).toFixed(2)}`);
      });
      console.log('');
    }
  }
}

checkDuplicates().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
