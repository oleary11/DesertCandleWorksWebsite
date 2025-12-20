// User management and points system using Postgres
import { db } from "./db/client";
import {
  users,
  orders,
  orderItems,
  pointsTransactions,
  passwordResetTokens,
  emailVerificationTokens,
  invoiceAccessTokens,
} from "./db/schema";
import { eq, desc, and, sql as drizzleSql } from "drizzle-orm";
import crypto from "crypto";
import { kv } from "@vercel/kv";

// Type definitions
export type User = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  points: number;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PasswordResetToken = {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export type EmailVerificationToken = {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export type PointsTransaction = {
  id: string;
  userId: string;
  amount: number;
  type: "earn" | "redeem" | "admin_adjustment";
  description: string;
  orderId?: string;
  createdAt: string;
};

export type Order = {
  id: string;
  userId?: string;
  email: string;
  totalCents: number;
  productSubtotalCents?: number;
  shippingCents?: number;
  taxCents?: number;
  pointsEarned: number;
  pointsRedeemed?: number;
  promotionId?: string;
  paymentMethod?: string;
  notes?: string;
  status: "pending" | "completed" | "cancelled";
  isGuest: boolean;
  items: Array<{
    productSlug: string;
    productName: string;
    variantId?: string;
    quantity: number;
    priceCents: number;
  }>;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  phone?: string;
  trackingNumber?: string;
  shippingStatus?: "pending" | "shipped" | "delivered";
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  completedAt?: string;
};

export type InvoiceAccessToken = {
  token: string;
  orderId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

// ============ Webhook Deduplication (Keep in Redis - Perfect for TTL) ============

const WEBHOOK_EVENTS_PREFIX = "webhook:event:";
const WEBHOOK_EVENT_TTL = 7 * 24 * 60 * 60; // 7 days

export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const exists = await kv.exists(`${WEBHOOK_EVENTS_PREFIX}${eventId}`);
  return exists === 1;
}

export async function markWebhookProcessed(eventId: string): Promise<void> {
  await kv.set(`${WEBHOOK_EVENTS_PREFIX}${eventId}`, true, { ex: WEBHOOK_EVENT_TTL });
}

// ============ User Management ============

export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      points: 0,
      emailVerified: false,
    })
    .returning();

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    points: user.points,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (result.length === 0) return null;

  const user = result[0];
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    points: user.points,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (result.length === 0) return null;

  const user = result[0];
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    points: user.points,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function listAllUsers(): Promise<User[]> {
  const result = await db.select().from(users).orderBy(desc(users.createdAt));

  return result.map((user) => ({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    points: user.points,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const bcrypt = await import("bcryptjs");
  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: string,
  updates: { firstName?: string; lastName?: string }
): Promise<User> {
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  return {
    id: updated.id,
    email: updated.email,
    passwordHash: updated.passwordHash,
    firstName: updated.firstName,
    lastName: updated.lastName,
    points: updated.points,
    emailVerified: updated.emailVerified,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
  // Note: Cascading deletes handled by foreign key constraints
}

// ============ Points Management ============

export async function addPoints(
  userId: string,
  amount: number,
  type: PointsTransaction["type"],
  description: string,
  orderId?: string
): Promise<PointsTransaction> {
  return await db.transaction(async (tx) => {
    // Update user points
    await tx
      .update(users)
      .set({
        points: drizzleSql`${users.points} + ${amount}`,
      })
      .where(eq(users.id, userId));

    // Create transaction record
    const [transaction] = await tx
      .insert(pointsTransactions)
      .values({
        userId,
        amount,
        type,
        description,
        orderId: orderId || null,
      })
      .returning();

    return {
      id: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      orderId: transaction.orderId || undefined,
      createdAt: transaction.createdAt.toISOString(),
    };
  });
}

export async function getUserPointsTransactions(
  userId: string,
  limit = 50
): Promise<PointsTransaction[]> {
  const result = await db
    .select()
    .from(pointsTransactions)
    .where(eq(pointsTransactions.userId, userId))
    .orderBy(desc(pointsTransactions.createdAt))
    .limit(limit);

  return result.map((t) => ({
    id: t.id,
    userId: t.userId,
    amount: t.amount,
    type: t.type,
    description: t.description,
    orderId: t.orderId || undefined,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function redeemPoints(
  userId: string,
  amount: number,
  description: string
): Promise<PointsTransaction> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.points < amount) throw new Error("Insufficient points");

  return addPoints(userId, -amount, "redeem", description);
}

export async function deductPoints(
  userId: string,
  amount: number,
  description: string
): Promise<PointsTransaction> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  return addPoints(userId, -amount, "admin_adjustment", description);
}

// ============ Order Management ============

export async function createOrder(
  email: string,
  checkoutSessionId: string,
  totalCents: number,
  items: Order["items"],
  userId?: string,
  productSubtotalCents?: number,
  shippingCents?: number,
  taxCents?: number,
  paymentMethod?: string,
  notes?: string,
  shippingAddress?: Order["shippingAddress"],
  phone?: string
): Promise<Order> {
  // Calculate points based on product subtotal only
  const pointsBase = productSubtotalCents ?? totalCents;
  const pointsEarned = Math.round(pointsBase / 100);

  return await db.transaction(async (tx) => {
    // Insert order
    const [order] = await tx
      .insert(orders)
      .values({
        id: checkoutSessionId,
        userId: userId || null,
        email,
        isGuest: !userId,
        totalCents,
        productSubtotalCents: productSubtotalCents || null,
        shippingCents: shippingCents || null,
        taxCents: taxCents || null,
        paymentMethod: (paymentMethod as "stripe" | "cash" | "card" | "square" | "other" | null) || null,
        notes: notes || null,
        pointsEarned,
        status: "pending",
        shippingStatus: "pending",
        phone: phone || null,
        shippingName: shippingAddress?.name || null,
        shippingLine1: shippingAddress?.line1 || null,
        shippingLine2: shippingAddress?.line2 || null,
        shippingCity: shippingAddress?.city || null,
        shippingState: shippingAddress?.state || null,
        shippingPostalCode: shippingAddress?.postalCode || null,
        shippingCountry: shippingAddress?.country || "US",
      })
      .returning();

    // Insert order items
    for (const item of items) {
      await tx.insert(orderItems).values({
        orderId: order.id,
        productSlug: item.productSlug,
        productName: item.productName,
        variantId: (item as { variantId?: string }).variantId || null,
        quantity: item.quantity,
        priceCents: item.priceCents,
      });
    }

    return {
      id: order.id,
      userId: order.userId || undefined,
      email: order.email,
      totalCents: order.totalCents,
      productSubtotalCents: order.productSubtotalCents || undefined,
      shippingCents: order.shippingCents || undefined,
      taxCents: order.taxCents || undefined,
      pointsEarned: order.pointsEarned,
      pointsRedeemed: order.pointsRedeemed || undefined,
      promotionId: order.promotionId || undefined,
      paymentMethod: order.paymentMethod || undefined,
      notes: order.notes || undefined,
      status: order.status,
      isGuest: order.isGuest,
      items,
      shippingAddress: shippingAddress || undefined,
      phone: order.phone || undefined,
      trackingNumber: order.trackingNumber || undefined,
      shippingStatus: (order.shippingStatus as "pending" | "shipped" | "delivered" | null) || undefined,
      shippedAt: order.shippedAt?.toISOString(),
      deliveredAt: order.deliveredAt?.toISOString(),
      createdAt: order.createdAt.toISOString(),
      completedAt: order.completedAt?.toISOString(),
    };
  });
}

export async function completeOrder(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) throw new Error("Order not found");
    if (order.status === "completed") return; // Already completed

    // Update order status
    await tx
      .update(orders)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Award points if user has an account
    if (order.userId) {
      await tx
        .update(users)
        .set({
          points: drizzleSql`${users.points} + ${order.pointsEarned}`,
        })
        .where(eq(users.id, order.userId));

      await tx.insert(pointsTransactions).values({
        userId: order.userId,
        amount: order.pointsEarned,
        type: "earn",
        description: `Purchase #${orderId.slice(0, 8)}`,
        orderId,
      });
    }
  });
}

export async function getUserOrders(userId: string, limit = 50): Promise<Order[]> {
  const orderResults = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  const ordersWithItems = await Promise.all(
    orderResults.map(async (order) => {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

      return {
        id: order.id,
        userId: order.userId || undefined,
        email: order.email,
        totalCents: order.totalCents,
        productSubtotalCents: order.productSubtotalCents || undefined,
        shippingCents: order.shippingCents || undefined,
        taxCents: order.taxCents || undefined,
        pointsEarned: order.pointsEarned,
        pointsRedeemed: order.pointsRedeemed || undefined,
        promotionId: order.promotionId || undefined,
        paymentMethod: order.paymentMethod || undefined,
        notes: order.notes || undefined,
        status: order.status,
        isGuest: order.isGuest,
        items: items.map((item) => ({
          productSlug: item.productSlug,
          productName: item.productName,
          variantId: item.variantId || undefined,
          quantity: item.quantity,
          priceCents: item.priceCents,
        })),
        shippingAddress: order.shippingLine1
          ? {
              name: order.shippingName || undefined,
              line1: order.shippingLine1 || undefined,
              line2: order.shippingLine2 || undefined,
              city: order.shippingCity || undefined,
              state: order.shippingState || undefined,
              postalCode: order.shippingPostalCode || undefined,
              country: order.shippingCountry || undefined,
            }
          : undefined,
        phone: order.phone || undefined,
        trackingNumber: order.trackingNumber || undefined,
        shippingStatus: (order.shippingStatus as "pending" | "shipped" | "delivered" | null) || undefined,
        shippedAt: order.shippedAt?.toISOString(),
        deliveredAt: order.deliveredAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
        completedAt: order.completedAt?.toISOString(),
      };
    })
  );

  return ordersWithItems;
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  return {
    id: order.id,
    userId: order.userId || undefined,
    email: order.email,
    totalCents: order.totalCents,
    productSubtotalCents: order.productSubtotalCents || undefined,
    shippingCents: order.shippingCents || undefined,
    taxCents: order.taxCents || undefined,
    pointsEarned: order.pointsEarned,
    pointsRedeemed: order.pointsRedeemed || undefined,
    promotionId: order.promotionId || undefined,
    paymentMethod: order.paymentMethod || undefined,
    notes: order.notes || undefined,
    status: order.status,
    isGuest: order.isGuest,
    items: items.map((item) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
      priceCents: item.priceCents,
    })),
    shippingAddress: order.shippingLine1
      ? {
          name: order.shippingName || undefined,
          line1: order.shippingLine1 || undefined,
          line2: order.shippingLine2 || undefined,
          city: order.shippingCity || undefined,
          state: order.shippingState || undefined,
          postalCode: order.shippingPostalCode || undefined,
          country: order.shippingCountry || undefined,
        }
      : undefined,
    phone: order.phone || undefined,
    trackingNumber: order.trackingNumber || undefined,
    shippingStatus: (order.shippingStatus as "pending" | "shipped" | "delivered" | null) || undefined,
    shippedAt: order.shippedAt?.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString(),
    createdAt: order.createdAt.toISOString(),
    completedAt: order.completedAt?.toISOString(),
  };
}

export async function getAllOrders(): Promise<Order[]> {
  const orderResults = await db.select().from(orders).orderBy(desc(orders.createdAt));

  const ordersWithItems = await Promise.all(
    orderResults.map(async (order) => {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

      return {
        id: order.id,
        userId: order.userId || undefined,
        email: order.email,
        totalCents: order.totalCents,
        productSubtotalCents: order.productSubtotalCents || undefined,
        shippingCents: order.shippingCents || undefined,
        taxCents: order.taxCents || undefined,
        pointsEarned: order.pointsEarned,
        pointsRedeemed: order.pointsRedeemed || undefined,
        promotionId: order.promotionId || undefined,
        paymentMethod: order.paymentMethod || undefined,
        notes: order.notes || undefined,
        status: order.status,
        isGuest: order.isGuest,
        items: items.map((item) => ({
          productSlug: item.productSlug,
          productName: item.productName,
          variantId: item.variantId || undefined,
          quantity: item.quantity,
          priceCents: item.priceCents,
        })),
        shippingAddress: order.shippingLine1
          ? {
              name: order.shippingName || undefined,
              line1: order.shippingLine1 || undefined,
              line2: order.shippingLine2 || undefined,
              city: order.shippingCity || undefined,
              state: order.shippingState || undefined,
              postalCode: order.shippingPostalCode || undefined,
              country: order.shippingCountry || undefined,
            }
          : undefined,
        phone: order.phone || undefined,
        trackingNumber: order.trackingNumber || undefined,
        shippingStatus: (order.shippingStatus as "pending" | "shipped" | "delivered" | null) || undefined,
        shippedAt: order.shippedAt?.toISOString(),
        deliveredAt: order.deliveredAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
        completedAt: order.completedAt?.toISOString(),
      };
    })
  );

  return ordersWithItems;
}

export async function deleteOrder(orderId: string): Promise<void> {
  await db.delete(orders).where(eq(orders.id, orderId));
  // orderItems cascade delete automatically
}

export async function updateOrderShipping(
  orderId: string,
  trackingNumber: string,
  shippingStatus: "shipped" | "delivered"
): Promise<Order> {
  const now = new Date();

  const [updated] = await db
    .update(orders)
    .set({
      trackingNumber,
      shippingStatus,
      shippedAt: shippingStatus === "shipped" ? now : undefined,
      deliveredAt: shippingStatus === "delivered" ? now : undefined,
    })
    .where(eq(orders.id, orderId))
    .returning();

  // Fetch items
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, updated.id));

  return {
    id: updated.id,
    userId: updated.userId || undefined,
    email: updated.email,
    totalCents: updated.totalCents,
    productSubtotalCents: updated.productSubtotalCents || undefined,
    shippingCents: updated.shippingCents || undefined,
    taxCents: updated.taxCents || undefined,
    pointsEarned: updated.pointsEarned,
    pointsRedeemed: updated.pointsRedeemed || undefined,
    promotionId: updated.promotionId || undefined,
    paymentMethod: updated.paymentMethod || undefined,
    notes: updated.notes || undefined,
    status: updated.status,
    isGuest: updated.isGuest,
    items: items.map((item) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
      priceCents: item.priceCents,
    })),
    shippingAddress: updated.shippingLine1
      ? {
          name: updated.shippingName || undefined,
          line1: updated.shippingLine1 || undefined,
          line2: updated.shippingLine2 || undefined,
          city: updated.shippingCity || undefined,
          state: updated.shippingState || undefined,
          postalCode: updated.shippingPostalCode || undefined,
          country: updated.shippingCountry || undefined,
        }
      : undefined,
    phone: updated.phone || undefined,
    trackingNumber: updated.trackingNumber || undefined,
    shippingStatus: (updated.shippingStatus as "pending" | "shipped" | "delivered" | null) || undefined,
    shippedAt: updated.shippedAt?.toISOString(),
    deliveredAt: updated.deliveredAt?.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    completedAt: updated.completedAt?.toISOString(),
  };
}

// ============ Password Reset ============

export async function createPasswordResetToken(email: string): Promise<PasswordResetToken | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  // Delete any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    token,
    userId: user.id,
    email: user.email,
    expiresAt,
  });

  return {
    token,
    userId: user.id,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export async function getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (result.length === 0) return null;

  const resetToken = result[0];
  return {
    token: resetToken.token,
    userId: resetToken.userId,
    email: resetToken.email,
    expiresAt: resetToken.expiresAt.toISOString(),
    createdAt: resetToken.createdAt.toISOString(),
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const resetToken = await getPasswordResetToken(token);
  if (!resetToken) return false;

  // Check if token is expired
  if (new Date(resetToken.expiresAt) < new Date()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return false;
  }

  // Update password
  await updatePassword(resetToken.userId, newPassword);

  // Delete used token
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));

  return true;
}

// ============ Guest Order Invoice Access ============

export async function createInvoiceAccessToken(orderId: string): Promise<InvoiceAccessToken> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(invoiceAccessTokens).values({
    token,
    orderId,
    email: order.email,
    expiresAt,
  });

  return {
    token,
    orderId,
    email: order.email,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export async function getInvoiceAccessToken(token: string): Promise<InvoiceAccessToken | null> {
  const result = await db
    .select()
    .from(invoiceAccessTokens)
    .where(eq(invoiceAccessTokens.token, token))
    .limit(1);

  if (result.length === 0) return null;

  const accessToken = result[0];
  return {
    token: accessToken.token,
    orderId: accessToken.orderId,
    email: accessToken.email,
    expiresAt: accessToken.expiresAt.toISOString(),
    createdAt: accessToken.createdAt.toISOString(),
  };
}

export async function getOrderByToken(token: string): Promise<Order | null> {
  const accessToken = await getInvoiceAccessToken(token);
  const isExpired = accessToken ? new Date(accessToken.expiresAt) < new Date() : false;

  if (!accessToken || isExpired) {
    if (isExpired && accessToken) {
      await db.delete(invoiceAccessTokens).where(eq(invoiceAccessTokens.token, token));
    }
    return null;
  }

  return await getOrderById(accessToken.orderId);
}

export async function linkGuestOrdersToUser(email: string, userId: string): Promise<number> {
  const normalizedEmail = email.toLowerCase().trim();

  // Get all guest orders for this email
  const guestOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.email, normalizedEmail), eq(orders.isGuest, true)));

  if (guestOrders.length === 0) return 0;

  let linkedCount = 0;

  for (const order of guestOrders) {
    await db.transaction(async (tx) => {
      // Update order to link to user
      await tx
        .update(orders)
        .set({
          userId,
          isGuest: false,
        })
        .where(eq(orders.id, order.id));

      // Award retroactive points if order is completed
      if (order.status === "completed") {
        await tx
          .update(users)
          .set({
            points: drizzleSql`${users.points} + ${order.pointsEarned}`,
          })
          .where(eq(users.id, userId));

        await tx.insert(pointsTransactions).values({
          userId,
          amount: order.pointsEarned,
          type: "earn",
          description: `Retroactive points for order #${order.id.slice(0, 8)}`,
          orderId: order.id,
        });
      }

      linkedCount++;
    });
  }

  return linkedCount;
}

// ============ Email Verification ============

export async function createEmailVerificationToken(userId: string): Promise<EmailVerificationToken> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(emailVerificationTokens).values({
    token,
    userId: user.id,
    email: user.email,
    expiresAt,
  });

  return {
    token,
    userId: user.id,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export async function getEmailVerificationToken(
  token: string
): Promise<EmailVerificationToken | null> {
  const result = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);

  if (result.length === 0) return null;

  const verificationToken = result[0];
  return {
    token: verificationToken.token,
    userId: verificationToken.userId,
    email: verificationToken.email,
    expiresAt: verificationToken.expiresAt.toISOString(),
    createdAt: verificationToken.createdAt.toISOString(),
  };
}

export async function verifyEmailWithToken(token: string): Promise<boolean> {
  const verificationToken = await getEmailVerificationToken(token);
  if (!verificationToken) return false;

  // Check if token is expired
  if (new Date(verificationToken.expiresAt) < new Date()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
    return false;
  }

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, verificationToken.userId));

  // Delete used token
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));

  return true;
}
