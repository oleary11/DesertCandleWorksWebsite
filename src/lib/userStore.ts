// User management and points system using Vercel KV (Redis)
import { kv } from "@vercel/kv";
import crypto from "crypto";

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
  userId: string;
  email: string;
  totalCents: number;
  pointsEarned: number;
  status: "pending" | "completed" | "cancelled";
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
  completedAt?: string;
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
  const passwordHash = await bcrypt.hash(password, 10);

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

// ============ Order Management ============

/**
 * Create order record
 */
export async function createOrder(
  userId: string,
  email: string,
  checkoutSessionId: string,
  totalCents: number,
  items: Order["items"]
): Promise<Order> {
  const pointsEarned = Math.floor(totalCents / 100); // 1 point per penny = 1 point per cent

  const order: Order = {
    id: checkoutSessionId,
    userId,
    email,
    totalCents,
    pointsEarned,
    status: "pending",
    items,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`order:${order.id}`, order);
  await kv.lpush(`orders:user:${userId}`, order.id);

  return order;
}

/**
 * Complete order and award points
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

  // Award points
  await addPoints(
    order.userId,
    order.pointsEarned,
    "earn",
    `Purchase #${orderId.slice(0, 8)}`,
    orderId
  );
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

// ============ Password Reset ============

/**
 * Create password reset token
 */
export async function createPasswordResetToken(email: string): Promise<PasswordResetToken | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

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
