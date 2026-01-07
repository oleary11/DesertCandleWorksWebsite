/**
 * Drizzle ORM Schema Definitions
 *
 * This file defines the database schema using Drizzle ORM's type-safe schema builder.
 * It mirrors the SQL schema in schema.sql but provides TypeScript types and runtime validation.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  date,
  bigserial,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// ENUMS
// ============================================

export const orderStatusEnum = pgEnum('order_status', ['pending', 'completed', 'cancelled']);
export const shippingStatusEnum = pgEnum('shipping_status', ['pending', 'shipped', 'delivered']);
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['stripe', 'cash', 'card', 'square', 'other']);
export const transactionTypeEnum = pgEnum('transaction_type', ['earn', 'redeem', 'admin_adjustment']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount']);
export const refundReasonEnum = pgEnum('refund_reason', [
  'customer_request',
  'damaged_product',
  'wrong_item_sent',
  'quality_issue',
  'shipping_delay',
  'duplicate_order',
  'other',
]);
export const refundStatusEnum = pgEnum('refund_status', ['pending', 'processing', 'completed', 'failed']);

// ============================================
// USERS
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  points: integer('points').notNull().default(0),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// ORDERS
// ============================================

export const orders = pgTable('orders', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  isGuest: boolean('is_guest').notNull().default(false),

  // Pricing
  totalCents: integer('total_cents').notNull(),
  productSubtotalCents: integer('product_subtotal_cents'),
  shippingCents: integer('shipping_cents'),
  taxCents: integer('tax_cents'),

  // Points & Promotions
  pointsEarned: integer('points_earned').notNull().default(0),
  pointsRedeemed: integer('points_redeemed').default(0),
  promotionId: varchar('promotion_id', { length: 100 }),

  // Payment
  paymentMethod: paymentMethodTypeEnum('payment_method'),
  notes: text('notes'),

  // Status
  status: orderStatusEnum('status').notNull().default('pending'),
  shippingStatus: shippingStatusEnum('shipping_status').default('pending'),

  // Shipping info
  trackingNumber: varchar('tracking_number', { length: 100 }),
  carrierCode: varchar('carrier_code', { length: 50 }),  // e.g., "stamps_com", "ups", "fedex"
  serviceCode: varchar('service_code', { length: 50 }),  // e.g., "usps_priority_mail"
  shipstationOrderId: varchar('shipstation_order_id', { length: 50 }),  // ShipStation order reference
  phone: varchar('phone', { length: 50 }),
  shippingName: varchar('shipping_name', { length: 200 }),
  shippingLine1: varchar('shipping_line1', { length: 255 }),
  shippingLine2: varchar('shipping_line2', { length: 255 }),
  shippingCity: varchar('shipping_city', { length: 100 }),
  shippingState: varchar('shipping_state', { length: 100 }),
  shippingPostalCode: varchar('shipping_postal_code', { length: 20 }),
  shippingCountry: varchar('shipping_country', { length: 2 }).default('US'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
});

export const orderItems = pgTable('order_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orderId: varchar('order_id', { length: 255 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productSlug: varchar('product_slug', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 100 }),
  sizeName: varchar('size_name', { length: 100 }),
  quantity: integer('quantity').notNull(),
  priceCents: integer('price_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate order items during migration
  uniqueOrderItem: uniqueIndex('unique_order_item_idx').on(
    table.orderId,
    table.productSlug,
    table.variantId,
    table.priceCents,
    table.quantity
  ),
}));

// ============================================
// PRODUCTS
// ============================================

export const products = pgTable('products', {
  slug: varchar('slug', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  stock: integer('stock').notNull().default(0),
  sku: varchar('sku', { length: 100 }),
  stripePriceId: varchar('stripe_price_id', { length: 100 }),
  squareCatalogId: varchar('square_catalog_id', { length: 100 }),
  squareVariantMapping: jsonb('square_variant_mapping'),
  imageUrl: text('image_url'),
  images: jsonb('images'),
  bestSeller: boolean('best_seller').default(false),
  youngDumb: boolean('young_dumb').default(false),
  alcoholType: varchar('alcohol_type', { length: 100 }),
  materialCost: integer('material_cost'),
  visibleOnWebsite: boolean('visible_on_website').default(true),
  variantConfig: jsonb('variant_config'),
  weight: jsonb('weight'),  // { value: number, units: "ounces" | "pounds" }
  dimensions: jsonb('dimensions'),  // { length: number, width: number, height: number, units: "inches" }
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// POINTS TRANSACTIONS
// ============================================

export const pointsTransactions = pgTable('points_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: transactionTypeEnum('type').notNull(),
  description: text('description').notNull(),
  orderId: varchar('order_id', { length: 255 }).references(() => orders.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// PURCHASES
// ============================================

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorName: varchar('vendor_name', { length: 255 }).notNull(),
  purchaseDate: date('purchase_date').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  receiptImageUrl: text('receipt_image_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseItems = pgTable('purchase_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate purchase items during migration
  uniquePurchaseItem: uniqueIndex('unique_purchase_item_idx').on(
    table.purchaseId,
    table.name,
    table.quantity,
    table.unitCostCents,
    table.category,
    table.notes
  ),
}));

// ============================================
// PROMOTIONS
// ============================================

export const promotions = pgTable('promotions', {
  id: varchar('id', { length: 100 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: integer('discount_value').notNull(),
  minPurchaseCents: integer('min_purchase_cents').default(0),
  maxRedemptions: integer('max_redemptions'),
  currentRedemptions: integer('current_redemptions').notNull().default(0),
  active: boolean('active').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// REFUNDS
// ============================================

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: varchar('order_id', { length: 255 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  stripeRefundId: varchar('stripe_refund_id', { length: 255 }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  reason: refundReasonEnum('reason').notNull(),
  reasonNote: text('reason_note'),
  status: refundStatusEnum('status').notNull().default('pending'),
  restoreInventory: boolean('restore_inventory').notNull().default(true),
  pointsToDeduct: integer('points_to_deduct').default(0),
  processedBy: varchar('processed_by', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const refundItems = pgTable('refund_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  refundId: uuid('refund_id').notNull().references(() => refunds.id, { onDelete: 'cascade' }),
  productSlug: varchar('product_slug', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 100 }),
  quantity: integer('quantity').notNull(),
  refundAmountCents: integer('refund_amount_cents').notNull(),
});

// ============================================
// ALCOHOL TYPES
// ============================================

export const alcoholTypes = pgTable('alcohol_types', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  sortOrder: integer('sort_order').default(9999),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// TOKENS
// ============================================

export const passwordResetTokens = pgTable('password_reset_tokens', {
  token: varchar('token', { length: 255 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  token: varchar('token', { length: 255 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceAccessTokens = pgTable('invoice_access_tokens', {
  token: varchar('token', { length: 255 }).primaryKey(),
  orderId: varchar('order_id', { length: 255 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// WEBHOOK EVENTS
// ============================================

export const webhookEvents = pgTable('webhook_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ============================================
// ORDER COUNTERS
// ============================================

export const orderCounters = pgTable('order_counters', {
  type: varchar('type', { length: 20 }).primaryKey(), // 'stripe', 'square', 'manual'
  counter: integer('counter').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// EMAIL TEMPLATES
// ============================================

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  message: text('message').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// SESSION MANAGEMENT
// ============================================

export const userSessions = pgTable('user_sessions', {
  token: varchar('token', { length: 64 }).primaryKey(), // crypto.randomBytes(32).toString('hex')
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  token: uuid('token').primaryKey(), // randomUUID()
  userId: uuid('user_id').notNull(), // Admin users stored in Redis (no FK constraint)
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'super_admin' | 'admin'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const mobileUploadSessions = pgTable('mobile_upload_sessions', {
  token: varchar('token', { length: 64 }).primaryKey(), // crypto.randomBytes(32).toString('hex')
  uploadedImages: jsonb('uploaded_images').notNull().default([]), // string[] of URLs
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ============================================
// RELATIONS (Optional - for Drizzle query API)
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  pointsTransactions: many(pointsTransactions),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
