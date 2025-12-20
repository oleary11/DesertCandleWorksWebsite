import { pgTable, foreignKey, varchar, uuid, boolean, integer, text, timestamp, uniqueIndex, bigserial, jsonb, unique, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const discountType = pgEnum("discount_type", ['percentage', 'fixed_amount'])
export const orderStatus = pgEnum("order_status", ['pending', 'completed', 'cancelled'])
export const paymentMethodType = pgEnum("payment_method_type", ['stripe', 'cash', 'card', 'square', 'other'])
export const refundReason = pgEnum("refund_reason", ['customer_request', 'damaged_product', 'wrong_item_sent', 'quality_issue', 'shipping_delay', 'duplicate_order', 'other'])
export const refundStatus = pgEnum("refund_status", ['pending', 'processing', 'completed', 'failed'])
export const shippingStatus = pgEnum("shipping_status", ['pending', 'shipped', 'delivered'])
export const transactionType = pgEnum("transaction_type", ['earn', 'redeem', 'admin_adjustment'])


export const orders = pgTable("orders", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: uuid("user_id"),
	email: varchar({ length: 255 }).notNull(),
	isGuest: boolean("is_guest").default(false).notNull(),
	totalCents: integer("total_cents").notNull(),
	productSubtotalCents: integer("product_subtotal_cents"),
	shippingCents: integer("shipping_cents"),
	taxCents: integer("tax_cents"),
	pointsEarned: integer("points_earned").default(0).notNull(),
	pointsRedeemed: integer("points_redeemed").default(0),
	promotionId: varchar("promotion_id", { length: 100 }),
	paymentMethod: paymentMethodType("payment_method"),
	notes: text(),
	status: orderStatus().default('pending').notNull(),
	shippingStatus: shippingStatus("shipping_status").default('pending'),
	trackingNumber: varchar("tracking_number", { length: 100 }),
	phone: varchar({ length: 50 }),
	shippingName: varchar("shipping_name", { length: 200 }),
	shippingLine1: varchar("shipping_line1", { length: 255 }),
	shippingLine2: varchar("shipping_line2", { length: 255 }),
	shippingCity: varchar("shipping_city", { length: 100 }),
	shippingState: varchar("shipping_state", { length: 100 }),
	shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
	shippingCountry: varchar("shipping_country", { length: 2 }).default('US'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	shippedAt: timestamp("shipped_at", { withTimezone: true, mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const orderItems = pgTable("order_items", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 255 }).notNull(),
	productSlug: varchar("product_slug", { length: 100 }).notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	variantId: varchar("variant_id", { length: 100 }),
	quantity: integer().notNull(),
	priceCents: integer("price_cents").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_order_item_idx").using("btree", table.orderId.asc().nullsLast().op("int4_ops"), table.productSlug.asc().nullsLast().op("int4_ops"), table.variantId.asc().nullsLast().op("int4_ops"), table.priceCents.asc().nullsLast().op("int4_ops"), table.quantity.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}).onDelete("cascade"),
]);

export const products = pgTable("products", {
	slug: varchar({ length: 100 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	priceCents: integer("price_cents").notNull(),
	stock: integer().default(0).notNull(),
	stripePriceId: varchar("stripe_price_id", { length: 100 }),
	imageUrl: text("image_url"),
	bestSeller: boolean("best_seller").default(false),
	youngDumb: boolean("young_dumb").default(false),
	variantConfig: jsonb("variant_config"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	points: integer().default(0).notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const pointsTransactions = pgTable("points_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	amount: integer().notNull(),
	type: transactionType().notNull(),
	description: text().notNull(),
	orderId: varchar("order_id", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "points_transactions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "points_transactions_order_id_orders_id_fk"
		}).onDelete("set null"),
]);

export const purchases = pgTable("purchases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	vendorName: varchar("vendor_name", { length: 255 }).notNull(),
	purchaseDate: date("purchase_date").notNull(),
	subtotalCents: integer("subtotal_cents").notNull(),
	shippingCents: integer("shipping_cents").default(0).notNull(),
	taxCents: integer("tax_cents").default(0).notNull(),
	totalCents: integer("total_cents").notNull(),
	receiptImageUrl: text("receipt_image_url"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const refundItems = pgTable("refund_items", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	refundId: uuid("refund_id").notNull(),
	productSlug: varchar("product_slug", { length: 100 }).notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	variantId: varchar("variant_id", { length: 100 }),
	quantity: integer().notNull(),
	refundAmountCents: integer("refund_amount_cents").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.refundId],
			foreignColumns: [refunds.id],
			name: "refund_items_refund_id_refunds_id_fk"
		}).onDelete("cascade"),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	token: varchar({ length: 255 }).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const emailVerificationTokens = pgTable("email_verification_tokens", {
	token: varchar({ length: 255 }).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "email_verification_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const invoiceAccessTokens = pgTable("invoice_access_tokens", {
	token: varchar({ length: 255 }).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "invoice_access_tokens_order_id_orders_id_fk"
		}).onDelete("cascade"),
]);

export const webhookEvents = pgTable("webhook_events", {
	eventId: varchar("event_id", { length: 255 }).primaryKey().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const refunds = pgTable("refunds", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: varchar("order_id", { length: 255 }).notNull(),
	stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
	userId: uuid("user_id"),
	email: varchar({ length: 255 }).notNull(),
	amountCents: integer("amount_cents").notNull(),
	reason: refundReason().notNull(),
	reasonNote: text("reason_note"),
	status: refundStatus().default('pending').notNull(),
	restoreInventory: boolean("restore_inventory").default(true).notNull(),
	pointsToDeduct: integer("points_to_deduct").default(0),
	processedBy: varchar("processed_by", { length: 100 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "refunds_order_id_orders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "refunds_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const alcoholTypes = pgTable("alcohol_types", {
	id: varchar({ length: 100 }).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	sortOrder: integer("sort_order").default(9999),
	archived: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("alcohol_types_name_unique").on(table.name),
]);

export const promotions = pgTable("promotions", {
	id: varchar({ length: 100 }).primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	description: text(),
	discountType: discountType("discount_type").notNull(),
	discountValue: integer("discount_value").notNull(),
	minPurchaseCents: integer("min_purchase_cents").default(0),
	maxRedemptions: integer("max_redemptions"),
	currentRedemptions: integer("current_redemptions").default(0).notNull(),
	active: boolean().default(true).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("promotions_code_unique").on(table.code),
]);

export const purchaseItems = pgTable("purchase_items", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	purchaseId: uuid("purchase_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	quantity: integer().notNull(),
	unitCostCents: integer("unit_cost_cents").notNull(),
	category: varchar({ length: 50 }).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.purchaseId],
			foreignColumns: [purchases.id],
			name: "purchase_items_purchase_id_purchases_id_fk"
		}).onDelete("cascade"),
]);
