import { relations } from "drizzle-orm/relations";
import { users, orders, orderItems, pointsTransactions, refunds, refundItems, passwordResetTokens, emailVerificationTokens, invoiceAccessTokens, purchases, purchaseItems } from "./schema";

export const ordersRelations = relations(orders, ({one, many}) => ({
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	orderItems: many(orderItems),
	pointsTransactions: many(pointsTransactions),
	invoiceAccessTokens: many(invoiceAccessTokens),
	refunds: many(refunds),
}));

export const usersRelations = relations(users, ({many}) => ({
	orders: many(orders),
	pointsTransactions: many(pointsTransactions),
	passwordResetTokens: many(passwordResetTokens),
	emailVerificationTokens: many(emailVerificationTokens),
	refunds: many(refunds),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
}));

export const pointsTransactionsRelations = relations(pointsTransactions, ({one}) => ({
	user: one(users, {
		fields: [pointsTransactions.userId],
		references: [users.id]
	}),
	order: one(orders, {
		fields: [pointsTransactions.orderId],
		references: [orders.id]
	}),
}));

export const refundItemsRelations = relations(refundItems, ({one}) => ({
	refund: one(refunds, {
		fields: [refundItems.refundId],
		references: [refunds.id]
	}),
}));

export const refundsRelations = relations(refunds, ({one, many}) => ({
	refundItems: many(refundItems),
	order: one(orders, {
		fields: [refunds.orderId],
		references: [orders.id]
	}),
	user: one(users, {
		fields: [refunds.userId],
		references: [users.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({one}) => ({
	user: one(users, {
		fields: [emailVerificationTokens.userId],
		references: [users.id]
	}),
}));

export const invoiceAccessTokensRelations = relations(invoiceAccessTokens, ({one}) => ({
	order: one(orders, {
		fields: [invoiceAccessTokens.orderId],
		references: [orders.id]
	}),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({one}) => ({
	purchase: one(purchases, {
		fields: [purchaseItems.purchaseId],
		references: [purchases.id]
	}),
}));

export const purchasesRelations = relations(purchases, ({many}) => ({
	purchaseItems: many(purchaseItems),
}));