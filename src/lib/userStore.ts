// User management and points system using Vercel KV (Redis)
import { kv } from "@vercel/kv";
import crypto from "crypto";

// Webhook event ID tracking for idempotency
const WEBHOOK_EVENTS_PREFIX = "webhook:event:";
const WEBHOOK_EVENT_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Check if a webhook event has already been processed
 */
export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const exists = await kv.exists(`${WEBHOOK_EVENTS_PREFIX}${eventId}`);
  return exists === 1;
}

/**
 * Mark a webhook event as processed
 */
export async function markWebhookProcessed(eventId: string): Promise<void> {
  await kv.set(`${WEBHOOK_EVENTS_PREFIX}${eventId}`, true, { ex: WEBHOOK_EVENT_TTL });
}

export type User = {
  id: string; // UUID
  email: string;
  passwordHash: string; // bcrypt hash
  firstName: string;
  lastName: string;
  points: number;
  emailVerified: boolean; // Email verification status
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};

export type PasswordResetToken = {
  token: string; // Random token
  userId: string;
  email: string;
  expiresAt: string; // ISO timestamp
  createdAt: string;
};

export type EmailVerificationToken = {
  token: string; // Random token
  userId: string;
  email: string;
  expiresAt: string; // ISO timestamp
  createdAt: string;
};

export type PointsTransaction = {
  id: string; // UUID
  userId: string;
  amount: number; // positive for earn, negative for redeem
  type: "earn" | "redeem" | "admin_adjustment";
  description: string; // e.g., "Purchase #abc123", "Redeemed for $5 off"
  orderId?: string; // Stripe checkout session ID
  createdAt: string; // ISO timestamp
};

export type Order = {
  id: string; // Stripe checkout session ID
  userId?: string; // Optional - null for guest orders
  email: string;
  totalCents: number; // Full order total (products + shipping + tax)
  productSubtotalCents?: number; // Products only (for points calculation)
  shippingCents?: number; // Shipping cost
  taxCents?: number; // Tax amount
  pointsEarned: number;
  pointsRedeemed?: number; // Points used for discount
  promotionId?: string; // Promotion code applied
  paymentMethod?: string; // Payment method (for manual sales: "cash", "card", "other")
  notes?: string; // Admin notes (for manual sales)
  status: "pending" | "completed" | "cancelled";
  isGuest: boolean; // True if order was placed without account
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
  completedAt?: string;
};

export type InvoiceAccessToken = {
  token: string; // Random secure token
  orderId: string;
  email: string;
  expiresAt: string; // ISO timestamp
  createdAt: string;
};

// ============ User Management ============

/**
 * Create a new user account
 */
export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email already exists
  const existingId = await kv.get<string>(`user:email:${normalizedEmail}`);
  if (existingId) {
    throw new Error("Email already registered");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 12);

  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    points: 0,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store user data
  await kv.set(`user:${user.id}`, user);
  // Create email -> userId mapping for login
  await kv.set(`user:email:${normalizedEmail}`, user.id);
  // Add to users index
  await kv.sadd("users:index", user.id);

  return user;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return await kv.get<User>(`user:${userId}`);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = await kv.get<string>(`user:email:${normalizedEmail}`);
  if (!userId) return null;
  return await getUserById(userId);
}

/**
 * List all users (for admin purposes)
 */
export async function listAllUsers(): Promise<User[]> {
  const userIds = await kv.smembers("users:index");
  if (!userIds || userIds.length === 0) return [];

  const users = await Promise.all(
    userIds.map(async (userId) => await getUserById(userId))
  );

  // Filter out nulls and return
  return users.filter((user): user is User => user !== null);
}

/**
 * Verify user password
 */
export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const bcrypt = await import("bcryptjs");
  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
}

/**
 * Update user password
 */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const updated: User = {
    ...user,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`user:${userId}`, updated);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: { firstName?: string; lastName?: string }
): Promise<User> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const updated: User = {
    ...user,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`user:${userId}`, updated);
  return updated;
}

/**
 * Delete user account
 */
export async function deleteUser(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;

  // Remove from email mapping
  await kv.del(`user:email:${user.email}`);
  // Remove from users index
  await kv.srem("users:index", userId);
  // Delete user data
  await kv.del(`user:${userId}`);

  // Note: Points transactions and orders are kept for audit trail
  // but marked as belonging to deleted user
}

// ============ Points Management ============

/**
 * Add points to user account
 */
export async function addPoints(
  userId: string,
  amount: number,
  type: PointsTransaction["type"],
  description: string,
  orderId?: string
): Promise<PointsTransaction> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const transaction: PointsTransaction = {
    id: crypto.randomUUID(),
    userId,
    amount,
    type,
    description,
    orderId,
    createdAt: new Date().toISOString(),
  };

  // Update user points
  const updatedUser: User = {
    ...user,
    points: user.points + amount,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`user:${userId}`, updatedUser);
  // Store transaction
  await kv.set(`points:transaction:${transaction.id}`, transaction);
  // Add to user's transaction index
  await kv.lpush(`points:user:${userId}`, transaction.id);

  return transaction;
}

/**
 * Get user's points transactions
 */
export async function getUserPointsTransactions(
  userId: string,
  limit = 50
): Promise<PointsTransaction[]> {
  const transactionIds = await kv.lrange<string>(`points:user:${userId}`, 0, limit - 1);
  if (!transactionIds || transactionIds.length === 0) return [];

  const transactions = await Promise.all(
    transactionIds.map((id) => kv.get<PointsTransaction>(`points:transaction:${id}`))
  );

  return transactions.filter((t): t is PointsTransaction => t !== null);
}

/**
 * Redeem points (subtract from balance)
 */
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

/**
 * Deduct points from user (for refunds or adjustments)
 * Unlike redeemPoints, this can deduct more points than the user has (going negative)
 */
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

/**
 * Create order record (supports both authenticated users and guests)
 */
export async function createOrder(
  email: string,
  checkoutSessionId: string,
  totalCents: number,
  items: Order["items"],
  userId?: string, // Optional - omit for guest orders
  productSubtotalCents?: number, // Product subtotal (for points calculation)
  shippingCents?: number, // Shipping cost
  taxCents?: number, // Tax amount
  paymentMethod?: string, // Payment method (for manual sales)
  notes?: string // Admin notes (for manual sales)
): Promise<Order> {
  // Calculate points based on product subtotal only (not shipping/tax)
  const pointsBase = productSubtotalCents ?? totalCents;
  const pointsEarned = Math.round(pointsBase / 100); // 1 point per dollar, rounded ($44.99 = 45 points)

  const order: Order = {
    id: checkoutSessionId,
    userId,
    email,
    totalCents,
    productSubtotalCents,
    shippingCents,
    taxCents,
    paymentMethod,
    notes,
    pointsEarned,
    status: "pending",
    isGuest: !userId,
    items,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`order:${order.id}`, order);

  // Add to global orders index for analytics
  await kv.sadd("orders:index", order.id);

  // Only add to user's order list if they have an account
  if (userId) {
    await kv.lpush(`orders:user:${userId}`, order.id);
  }

  // Index guest orders by email for retroactive linking
  if (!userId) {
    await kv.lpush(`orders:guest:${email.toLowerCase()}`, order.id);
  }

  return order;
}

/**
 * Complete order and award points (only if user has account)
 */
export async function completeOrder(orderId: string): Promise<void> {
  const order = await kv.get<Order>(`order:${orderId}`);
  if (!order) throw new Error("Order not found");
  if (order.status === "completed") return; // Already completed

  const updated: Order = {
    ...order,
    status: "completed",
    completedAt: new Date().toISOString(),
  };

  await kv.set(`order:${orderId}`, updated);

  // Award points only if user has an account
  if (order.userId) {
    await addPoints(
      order.userId,
      order.pointsEarned,
      "earn",
      `Purchase #${orderId.slice(0, 8)}`,
      orderId
    );
  }
}

/**
 * Get user's orders
 */
export async function getUserOrders(userId: string, limit = 50): Promise<Order[]> {
  const orderIds = await kv.lrange<string>(`orders:user:${userId}`, 0, limit - 1);
  if (!orderIds || orderIds.length === 0) return [];

  const orders = await Promise.all(orderIds.map((id) => kv.get<Order>(`order:${id}`)));

  return orders.filter((o): o is Order => o !== null);
}

/**
 * Get order by ID
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  return await kv.get<Order>(`order:${orderId}`);
}

/**
 * Get all orders (for admin analytics)
 */
export async function getAllOrders(): Promise<Order[]> {
  const orderIds = await kv.smembers("orders:index");
  if (!orderIds || orderIds.length === 0) return [];

  const orders = await Promise.all(
    orderIds.map((id) => kv.get<Order>(`order:${id}`))
  );

  return orders
    .filter((o): o is Order => o !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ============ Password Reset ============

/**
 * Create password reset token
 * Invalidates any existing tokens for this user
 */
export async function createPasswordResetToken(email: string): Promise<PasswordResetToken | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  // Invalidate any existing reset token for this user
  const existingTokenKey = `password:reset:user:${user.id}`;
  const oldToken = await kv.get<string>(existingTokenKey);
  if (oldToken) {
    await kv.del(`password:reset:${oldToken}`);
  }

  const token = crypto.randomBytes(32).toString("hex");
  const resetToken: PasswordResetToken = {
    token,
    userId: user.id,
    email: user.email,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    createdAt: new Date().toISOString(),
  };

  // Store token with 1 hour expiration
  await kv.set(`password:reset:${token}`, resetToken, { ex: 3600 });
  // Track latest token for this user (for invalidation)
  await kv.set(existingTokenKey, token, { ex: 3600 });

  return resetToken;
}

/**
 * Get password reset token
 */
export async function getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  return await kv.get<PasswordResetToken>(`password:reset:${token}`);
}

/**
 * Reset password using token
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const resetToken = await getPasswordResetToken(token);
  if (!resetToken) return false;

  // Check if token is expired
  if (new Date(resetToken.expiresAt) < new Date()) {
    await kv.del(`password:reset:${token}`);
    return false;
  }

  // Update password
  await updatePassword(resetToken.userId, newPassword);

  // Delete used token
  await kv.del(`password:reset:${token}`);

  return true;
}

// ============ Guest Order Invoice Access ============

/**
 * Create invoice access token for guest orders
 */
export async function createInvoiceAccessToken(orderId: string): Promise<InvoiceAccessToken> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const token = crypto.randomBytes(32).toString("hex");
  const accessToken: InvoiceAccessToken = {
    token,
    orderId,
    email: order.email,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    createdAt: new Date().toISOString(),
  };

  // Store token with 30 day expiration
  await kv.set(`invoice:token:${token}`, accessToken, { ex: 30 * 24 * 60 * 60 });

  return accessToken;
}

/**
 * Get invoice access token
 */
export async function getInvoiceAccessToken(token: string): Promise<InvoiceAccessToken | null> {
  return await kv.get<InvoiceAccessToken>(`invoice:token:${token}`);
}

/**
 * Verify invoice access token and return order
 * Uses constant-time comparison to prevent timing attacks
 */
export async function getOrderByToken(token: string): Promise<Order | null> {
  const accessToken = await getInvoiceAccessToken(token);
  const isExpired = accessToken ? new Date(accessToken.expiresAt) < new Date() : false;

  // Constant-time check - always evaluate both conditions
  if (!accessToken || isExpired) {
    if (isExpired && accessToken) {
      await kv.del(`invoice:token:${token}`);
    }
    return null;
  }

  return await getOrderById(accessToken.orderId);
}

/**
 * Link guest orders to newly created user account
 * Returns the number of orders linked
 */
export async function linkGuestOrdersToUser(email: string, userId: string): Promise<number> {
  const normalizedEmail = email.toLowerCase().trim();

  // Get all guest orders for this email
  const guestOrderIds = await kv.lrange<string>(`orders:guest:${normalizedEmail}`, 0, -1);
  if (!guestOrderIds || guestOrderIds.length === 0) return 0;

  let linkedCount = 0;

  for (const orderId of guestOrderIds) {
    const order = await getOrderById(orderId);
    if (!order || !order.isGuest) continue;

    // Update order to link to user
    const updated: Order = {
      ...order,
      userId,
      isGuest: false,
    };

    await kv.set(`order:${orderId}`, updated);
    await kv.lpush(`orders:user:${userId}`, orderId);

    // Award retroactive points if order is completed
    if (order.status === "completed") {
      await addPoints(
        userId,
        order.pointsEarned,
        "earn",
        `Retroactive points for order #${orderId.slice(0, 8)}`,
        orderId
      );
    }

    linkedCount++;
  }

  // Remove guest order index (orders are now in user's list)
  await kv.del(`orders:guest:${normalizedEmail}`);

  return linkedCount;
}

// ============ Email Verification ============

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(userId: string): Promise<EmailVerificationToken> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const token = crypto.randomBytes(32).toString("hex");
  const verificationToken: EmailVerificationToken = {
    token,
    userId: user.id,
    email: user.email,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    createdAt: new Date().toISOString(),
  };

  // Store token with 24 hour expiration
  await kv.set(`email:verify:${token}`, verificationToken, { ex: 86400 });

  return verificationToken;
}

/**
 * Get email verification token
 */
export async function getEmailVerificationToken(
  token: string
): Promise<EmailVerificationToken | null> {
  return await kv.get<EmailVerificationToken>(`email:verify:${token}`);
}

/**
 * Verify email using token
 */
export async function verifyEmailWithToken(token: string): Promise<boolean> {
  const verificationToken = await getEmailVerificationToken(token);
  if (!verificationToken) return false;

  // Check if token is expired
  if (new Date(verificationToken.expiresAt) < new Date()) {
    await kv.del(`email:verify:${token}`);
    return false;
  }

  // Mark email as verified
  const user = await getUserById(verificationToken.userId);
  if (!user) return false;

  const updated: User = {
    ...user,
    emailVerified: true,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`user:${user.id}`, updated);

  // Delete used token
  await kv.del(`email:verify:${token}`);

  return true;
}
