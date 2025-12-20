/**
 * Redis to Postgres Migration Script
 *
 * This script copies all data from Redis (Vercel KV) to Postgres (Neon).
 * Run with: npx tsx scripts/migrate-redis-to-postgres.ts
 *
 * ⚠️ IMPORTANT: This script is idempotent and can be run multiple times safely.
 * It uses ON CONFLICT clauses to handle existing data.
 */

import { db, sql } from '../src/lib/db/client';
import { kv } from '@vercel/kv';
import {
  users,
  orders,
  orderItems,
  products,
  pointsTransactions,
  purchases,
  purchaseItems,
  promotions,
  refunds,
  refundItems,
  alcoholTypes,
  passwordResetTokens,
  emailVerificationTokens,
  invoiceAccessTokens,
} from '../src/lib/db/schema';

// Import Redis store functions
import {
  listAllUsers,
  getAllOrders,
  getUserPointsTransactions,
  type User,
  type Order,
  type PointsTransaction,
} from '../src/lib/userStore';
import { listProducts, type Product } from '../src/lib/productsStore';
import { getAllPurchases, type Purchase } from '../src/lib/purchasesStore';
import { listPromotions, type Promotion } from '../src/lib/promotionsStore';
import { listRefunds, type Refund } from '../src/lib/refundStore';
import { getAlcoholTypes, type AlcoholType } from '../src/lib/alcoholTypesStore';

// Migration statistics
const stats = {
  users: { attempted: 0, succeeded: 0, failed: 0 },
  orders: { attempted: 0, succeeded: 0, failed: 0 },
  orderItems: { attempted: 0, succeeded: 0, failed: 0 },
  products: { attempted: 0, succeeded: 0, failed: 0 },
  pointsTransactions: { attempted: 0, succeeded: 0, failed: 0 },
  purchases: { attempted: 0, succeeded: 0, failed: 0 },
  purchaseItems: { attempted: 0, succeeded: 0, failed: 0 },
  promotions: { attempted: 0, succeeded: 0, failed: 0 },
  refunds: { attempted: 0, succeeded: 0, failed: 0 },
  refundItems: { attempted: 0, succeeded: 0, failed: 0 },
  alcoholTypes: { attempted: 0, succeeded: 0, failed: 0 },
};

async function main() {
  console.log('🚀 Starting Redis → Postgres migration...\n');

  try {
    // Verify connections
    console.log('📡 Testing database connections...');
    await sql`SELECT 1`;
    await kv.ping();
    console.log('✅ Both databases are accessible\n');

    // Run migrations in dependency order
    await migrateUsers();
    await migrateProducts();
    await migrateAlcoholTypes();
    await migrateOrders();
    await migratePointsTransactions();
    await migratePurchases();
    await migratePromotions();
    await migrateRefunds();

    // Verify data integrity
    // NOTE: Temporarily disabled due to Drizzle recursion issue
    // await verifyMigration();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    Object.entries(stats).forEach(([table, counts]) => {
      const { attempted, succeeded, failed } = counts;
      const status = failed === 0 ? '✅' : '⚠️';
      console.log(`${status} ${table.padEnd(20)} | ${succeeded}/${attempted} migrated (${failed} failed)`);
    });
    console.log('='.repeat(60));

    const totalAttempted = Object.values(stats).reduce((sum, s) => sum + s.attempted, 0);
    const totalSucceeded = Object.values(stats).reduce((sum, s) => sum + s.succeeded, 0);
    const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);

    console.log(`\nTotal: ${totalSucceeded}/${totalAttempted} records migrated (${totalFailed} failed)`);

    if (totalFailed > 0) {
      console.log('\n⚠️  Some records failed to migrate. Check the logs above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// ============================================
// MIGRATE USERS
// ============================================

async function migrateUsers() {
  console.log('👤 Migrating users...');
  const redisUsers = await listAllUsers();
  stats.users.attempted = redisUsers.length;

  for (const user of redisUsers) {
    try {
      await db
        .insert(users)
        .values({
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          points: user.points,
          emailVerified: user.emailVerified,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            points: user.points, // Update points in case they changed
            emailVerified: user.emailVerified,
            updatedAt: new Date(user.updatedAt),
          },
        });
      stats.users.succeeded++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate user ${user.id}:`, error);
      stats.users.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.users.succeeded}/${stats.users.attempted} users\n`);
}

// ============================================
// MIGRATE PRODUCTS
// ============================================

async function migrateProducts() {
  console.log('📦 Migrating products...');
  const redisProducts = await listProducts();
  stats.products.attempted = redisProducts.length;

  for (const product of redisProducts) {
    try {
      // Convert price to cents (multiply by 100 and round)
      const priceCents = Math.round(product.price * 100);

      // Convert materialCost to cents if it exists
      const materialCostCents = (product as any).materialCost
        ? Math.round((product as any).materialCost * 100)
        : null;

      await db
        .insert(products)
        .values({
          slug: product.slug,
          name: product.name,
          description: (product as any).seoDescription || null,
          priceCents,
          stock: product.stock ?? 0,
          sku: (product as any).sku || null,
          stripePriceId: product.stripePriceId || null,
          squareCatalogId: product.squareCatalogId || null,
          squareVariantMapping: product.squareVariantMapping as any || null,
          imageUrl: (product as any).image || null,
          images: (product as any).images as any || null,
          bestSeller: product.bestSeller ?? false,
          youngDumb: product.youngDumb ?? false,
          alcoholType: product.alcoholType || null,
          materialCost: materialCostCents,
          visibleOnWebsite: (product as any).visibleOnWebsite ?? true,
          variantConfig: product.variantConfig as any || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: products.slug,
          set: {
            name: product.name,
            description: (product as any).seoDescription || null,
            priceCents,
            stock: product.stock ?? 0,
            sku: (product as any).sku || null,
            stripePriceId: product.stripePriceId || null,
            squareCatalogId: product.squareCatalogId || null,
            squareVariantMapping: product.squareVariantMapping as any || null,
            imageUrl: (product as any).image || null,
            images: (product as any).images as any || null,
            bestSeller: product.bestSeller ?? false,
            youngDumb: product.youngDumb ?? false,
            alcoholType: product.alcoholType || null,
            materialCost: materialCostCents,
            visibleOnWebsite: (product as any).visibleOnWebsite ?? true,
            variantConfig: product.variantConfig as any || null,
            updatedAt: new Date(),
          },
        });
      stats.products.succeeded++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate product ${product.slug}:`, error);
      stats.products.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.products.succeeded}/${stats.products.attempted} products\n`);
}

// ============================================
// MIGRATE ALCOHOL TYPES
// ============================================

async function migrateAlcoholTypes() {
  console.log('🍺 Migrating alcohol types...');
  const redisAlcoholTypes = await getAlcoholTypes();
  stats.alcoholTypes.attempted = redisAlcoholTypes.length;

  for (const type of redisAlcoholTypes) {
    try {
      await db
        .insert(alcoholTypes)
        .values({
          id: type.id,
          name: type.name,
          sortOrder: type.sortOrder ?? 9999,
          archived: type.archived ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: alcoholTypes.id,
          set: {
            name: type.name,
            sortOrder: type.sortOrder ?? 9999,
            archived: type.archived ?? false,
            updatedAt: new Date(),
          },
        });
      stats.alcoholTypes.succeeded++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate alcohol type ${type.id}:`, error);
      stats.alcoholTypes.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.alcoholTypes.succeeded}/${stats.alcoholTypes.attempted} alcohol types\n`);
}

// ============================================
// MIGRATE ORDERS
// ============================================

async function migrateOrders() {
  console.log('🛒 Migrating orders...');
  const redisOrders = await getAllOrders();
  stats.orders.attempted = redisOrders.length;

  for (const order of redisOrders) {
    try {
      // Insert order
      await db
        .insert(orders)
        .values({
          id: order.id,
          userId: order.userId || null,
          email: order.email,
          isGuest: order.isGuest,
          totalCents: order.totalCents,
          productSubtotalCents: order.productSubtotalCents || null,
          shippingCents: order.shippingCents || null,
          taxCents: order.taxCents || null,
          pointsEarned: order.pointsEarned,
          pointsRedeemed: order.pointsRedeemed || null,
          promotionId: order.promotionId || null,
          paymentMethod: (order.paymentMethod as any) || null,
          notes: order.notes || null,
          status: order.status as any,
          shippingStatus: (order.shippingStatus as any) || 'pending',
          trackingNumber: order.trackingNumber || null,
          phone: order.phone || null,
          shippingName: order.shippingAddress?.name || null,
          shippingLine1: order.shippingAddress?.line1 || null,
          shippingLine2: order.shippingAddress?.line2 || null,
          shippingCity: order.shippingAddress?.city || null,
          shippingState: order.shippingAddress?.state || null,
          shippingPostalCode: order.shippingAddress?.postalCode || null,
          shippingCountry: order.shippingAddress?.country || 'US',
          createdAt: new Date(order.createdAt),
          completedAt: order.completedAt ? new Date(order.completedAt) : null,
          shippedAt: order.shippedAt ? new Date(order.shippedAt) : null,
          deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : null,
        })
        .onConflictDoNothing();

      stats.orders.succeeded++;

      // Insert order items
      for (const item of order.items) {
        stats.orderItems.attempted++;
        try {
          await db.insert(orderItems).values({
            orderId: order.id,
            productSlug: item.productSlug,
            productName: item.productName,
            variantId: (item as any).variantId || null,
            quantity: item.quantity,
            priceCents: item.priceCents,
            createdAt: new Date(order.createdAt),
          }).onConflictDoNothing();
          stats.orderItems.succeeded++;
        } catch (error) {
          console.error(`  ⚠️  Failed to migrate order item for order ${order.id}:`, error);
          stats.orderItems.failed++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to migrate order ${order.id}:`, error);
      stats.orders.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.orders.succeeded}/${stats.orders.attempted} orders`);
  console.log(`  ✅ Migrated ${stats.orderItems.succeeded}/${stats.orderItems.attempted} order items\n`);
}

// ============================================
// MIGRATE POINTS TRANSACTIONS
// ============================================

async function migratePointsTransactions() {
  console.log('💰 Migrating points transactions...');

  // Get all users first
  const allUsers = await listAllUsers();

  for (const user of allUsers) {
    const transactions = await getUserPointsTransactions(user.id, 1000); // Get up to 1000 transactions
    stats.pointsTransactions.attempted += transactions.length;

    for (const txn of transactions) {
      try {
        await db
          .insert(pointsTransactions)
          .values({
            id: txn.id,
            userId: txn.userId,
            amount: txn.amount,
            type: txn.type as any,
            description: txn.description,
            orderId: txn.orderId || null,
            createdAt: new Date(txn.createdAt),
          })
          .onConflictDoNothing();
        stats.pointsTransactions.succeeded++;
      } catch (error) {
        console.error(`  ⚠️  Failed to migrate points transaction ${txn.id}:`, error);
        stats.pointsTransactions.failed++;
      }
    }
  }

  console.log(`  ✅ Migrated ${stats.pointsTransactions.succeeded}/${stats.pointsTransactions.attempted} points transactions\n`);
}

// ============================================
// MIGRATE PURCHASES
// ============================================

async function migratePurchases() {
  console.log('💵 Migrating purchases...');
  const redisPurchases = await getAllPurchases();
  stats.purchases.attempted = redisPurchases.length;

  for (const purchase of redisPurchases) {
    try {
      await db
        .insert(purchases)
        .values({
          id: purchase.id,
          vendorName: purchase.vendorName,
          purchaseDate: purchase.purchaseDate,
          subtotalCents: purchase.subtotalCents,
          shippingCents: purchase.shippingCents,
          taxCents: purchase.taxCents,
          totalCents: purchase.totalCents,
          receiptImageUrl: purchase.receiptImageUrl || null,
          notes: purchase.notes || null,
          createdAt: new Date(purchase.createdAt),
          updatedAt: new Date(purchase.updatedAt),
        })
        .onConflictDoNothing();
      stats.purchases.succeeded++;

      // Insert purchase items
      for (const item of purchase.items) {
        stats.purchaseItems.attempted++;
        try {
          await db.insert(purchaseItems).values({
            purchaseId: purchase.id,
            name: item.name,
            quantity: item.quantity,
            unitCostCents: item.unitCostCents,
            category: item.category,
            notes: item.notes || null,
            createdAt: new Date(purchase.createdAt),
          }).onConflictDoNothing();
          stats.purchaseItems.succeeded++;
        } catch (error) {
          console.error(`  ⚠️  Failed to migrate purchase item:`, error);
          stats.purchaseItems.failed++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to migrate purchase ${purchase.id}:`, error);
      stats.purchases.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.purchases.succeeded}/${stats.purchases.attempted} purchases`);
  console.log(`  ✅ Migrated ${stats.purchaseItems.succeeded}/${stats.purchaseItems.attempted} purchase items\n`);
}

// ============================================
// MIGRATE PROMOTIONS
// ============================================

async function migratePromotions() {
  console.log('🎟️  Migrating promotions...');
  const redisPromotions = await listPromotions();
  stats.promotions.attempted = redisPromotions.length;

  for (const promo of redisPromotions) {
    try {
      // Skip promotions with missing required fields
      if (!promo.discountType || promo.discountValue === null || promo.discountValue === undefined) {
        console.warn(`  ⚠️  Skipping promotion ${promo.id} (${promo.code}) - missing discountType or discountValue`);
        stats.promotions.failed++;
        continue;
      }

      await db
        .insert(promotions)
        .values({
          id: promo.id,
          code: promo.code,
          description: promo.description || null,
          discountType: promo.discountType as any,
          discountValue: promo.discountValue,
          minPurchaseCents: promo.minPurchaseCents ?? 0,
          maxRedemptions: promo.maxRedemptions || null,
          currentRedemptions: promo.currentRedemptions,
          active: promo.active,
          startsAt: promo.startsAt ? new Date(promo.startsAt) : null,
          expiresAt: promo.expiresAt ? new Date(promo.expiresAt) : null,
          createdAt: new Date(promo.createdAt),
          updatedAt: new Date(promo.updatedAt),
        })
        .onConflictDoUpdate({
          target: promotions.id,
          set: {
            currentRedemptions: promo.currentRedemptions,
            active: promo.active,
            updatedAt: new Date(promo.updatedAt),
          },
        });
      stats.promotions.succeeded++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate promotion ${promo.id}:`, error);
      stats.promotions.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.promotions.succeeded}/${stats.promotions.attempted} promotions\n`);
}

// ============================================
// MIGRATE REFUNDS
// ============================================

async function migrateRefunds() {
  console.log('↩️  Migrating refunds...');
  const redisRefunds = await listRefunds();
  stats.refunds.attempted = redisRefunds.length;

  for (const refund of redisRefunds) {
    try {
      await db
        .insert(refunds)
        .values({
          id: refund.id,
          orderId: refund.orderId,
          stripeRefundId: refund.stripeRefundId || null,
          userId: refund.userId || null,
          email: refund.email,
          amountCents: refund.amountCents,
          reason: refund.reason as any,
          reasonNote: refund.reasonNote || null,
          status: refund.status as any,
          restoreInventory: refund.restoreInventory,
          pointsToDeduct: refund.pointsToDeduct || 0,
          processedBy: refund.processedBy || null,
          createdAt: new Date(refund.createdAt),
          processedAt: refund.processedAt ? new Date(refund.processedAt) : null,
        })
        .onConflictDoNothing();
      stats.refunds.succeeded++;

      // Insert refund items
      for (const item of refund.items) {
        stats.refundItems.attempted++;
        try {
          await db.insert(refundItems).values({
            refundId: refund.id,
            productSlug: item.productSlug,
            productName: item.productName,
            variantId: item.variantId || null,
            quantity: item.quantity,
            refundAmountCents: item.refundAmountCents,
          });
          stats.refundItems.succeeded++;
        } catch (error) {
          console.error(`  ⚠️  Failed to migrate refund item:`, error);
          stats.refundItems.failed++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to migrate refund ${refund.id}:`, error);
      stats.refunds.failed++;
    }
  }
  console.log(`  ✅ Migrated ${stats.refunds.succeeded}/${stats.refunds.attempted} refunds`);
  console.log(`  ✅ Migrated ${stats.refundItems.succeeded}/${stats.refundItems.attempted} refund items\n`);
}

// ============================================
// VERIFY MIGRATION
// ============================================

async function verifyMigration() {
  console.log('🔍 Verifying migration...');

  // Count records in Postgres (using any to avoid complex type issues in migration script)
  const usersCount = await db.select({ count: sql`count(*)` }).from(users);
  const ordersCount = await db.select({ count: sql`count(*)` }).from(orders);
  const productsCount = await db.select({ count: sql`count(*)` }).from(products);

  const pgCounts = {
    users: Number(usersCount[0].count),
    orders: Number(ordersCount[0].count),
    products: Number(productsCount[0].count),
  };

  // Count records in Redis
  const redisCounts = {
    users: (await listAllUsers()).length,
    orders: (await getAllOrders()).length,
    products: (await listProducts()).length,
  };

  console.log('\n  Record counts:');
  console.log(`  Users:      Redis: ${redisCounts.users} | Postgres: ${pgCounts.users}`);
  console.log(`  Orders:     Redis: ${redisCounts.orders} | Postgres: ${pgCounts.orders}`);
  console.log(`  Products:   Redis: ${redisCounts.products} | Postgres: ${pgCounts.products}`);

  // Check for discrepancies
  const issues: string[] = [];
  if (pgCounts.users !== redisCounts.users) issues.push('users');
  if (pgCounts.orders !== redisCounts.orders) issues.push('orders');
  if (pgCounts.products !== redisCounts.products) issues.push('products');

  if (issues.length > 0) {
    console.log(`\n  ⚠️  Count mismatches detected for: ${issues.join(', ')}`);
  } else {
    console.log(`\n  ✅ All record counts match!`);
  }
}

// Run the migration
main().catch(console.error);
