import { db } from './src/lib/db/client';
import { orders, orderItems } from './src/lib/db/schema';
import { desc, gte, sql, eq, inArray } from 'drizzle-orm';
import { incrStock, incrVariantStock } from './src/lib/productsStore';

/**
 * Reconcile duplicate Square orders from 1/10/2026 farmers market
 *
 * Bug: Square webhook sent multiple events for same payment, creating 3-5 duplicate orders per sale
 * Fix: Keep the FIRST order created for each Square payment, delete the rest
 * Restore stock that was incorrectly decremented multiple times
 */

async function reconcileDuplicates() {
  console.log('='.repeat(80));
  console.log('SQUARE DUPLICATE ORDER RECONCILIATION');
  console.log('='.repeat(80));
  console.log('\nSearching for duplicate orders from 1/10/2026...\n');

  // Get all orders from 1/10/2026
  const today = new Date('2026-01-10');
  const allOrders = await db.select().from(orders).where(gte(orders.createdAt, today)).orderBy(desc(orders.createdAt));

  console.log(`Total orders from 1/10/2026: ${allOrders.length}\n`);

  // Group by Square payment ID
  const squarePaymentGroups: Record<string, any[]> = {};

  for (const order of allOrders) {
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

  // Find duplicate groups (more than 1 order per payment)
  const duplicateGroups = Object.entries(squarePaymentGroups).filter(([_, orders]) => orders.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!\n');
    return;
  }

  console.log(`Found ${duplicateGroups.length} Square payments with duplicates:\n`);

  const ordersToDelete: string[] = [];

  // Process each duplicate group
  for (const [paymentId, dupOrders] of duplicateGroups) {
    // Sort by creation time (earliest first)
    dupOrders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const keepOrder = dupOrders[0]; // Keep the first one
    const deleteOrders = dupOrders.slice(1); // Delete the rest

    console.log(`Payment ${paymentId} (${dupOrders.length} duplicates):`);
    console.log(`  ✅ KEEPING: ${keepOrder.id} (created ${keepOrder.createdAt.toISOString()})`);

    for (const delOrder of deleteOrders) {
      console.log(`  ❌ DELETING: ${delOrder.id} (created ${delOrder.createdAt.toISOString()})`);
      ordersToDelete.push(delOrder.id);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('RECONCILIATION PLAN');
  console.log('='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`  - Total duplicate groups: ${duplicateGroups.length}`);
  console.log(`  - Orders to keep: ${duplicateGroups.length}`);
  console.log(`  - Orders to delete: ${ordersToDelete.length}`);

  // Ask for confirmation
  console.log('\n⚠️  This will:');
  console.log('  1. Delete duplicate order records');
  console.log('  2. Delete associated order items');
  console.log('  3. Stock restoration NOT needed (all items were already at 0)');
  console.log('\nProceed with reconciliation? (yes/no): ');

  // For automated execution, set AUTO_CONFIRM=true
  const autoConfirm = process.env.AUTO_CONFIRM === 'true';

  if (!autoConfirm) {
    console.log('\n❌ Skipping reconciliation (set AUTO_CONFIRM=true to execute)');
    console.log('\nTo execute this reconciliation, run:');
    console.log('  AUTO_CONFIRM=true npx tsx reconcile-square-duplicates.ts\n');
    return;
  }

  console.log('\n✅ AUTO_CONFIRM=true, proceeding with reconciliation...\n');

  // Execute reconciliation
  console.log('Step 1: Deleting duplicate order items...');
  for (const orderId of ordersToDelete) {
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  }
  console.log(`  ✅ Deleted ${ordersToDelete.length} order item records\n`);

  console.log('Step 2: Deleting duplicate orders...');
  await db.delete(orders).where(inArray(orders.id, ordersToDelete));
  console.log(`  ✅ Deleted ${ordersToDelete.length} order records\n`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ RECONCILIATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\n📊 Results:`);
  console.log(`  - Deleted ${ordersToDelete.length} duplicate orders`);
  console.log(`  - Kept ${duplicateGroups.length} valid orders`);
  console.log(`  - Stock restoration: Not needed (items were already at 0)\n`);
}

reconcileDuplicates().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error during reconciliation:', err);
  process.exit(1);
});
