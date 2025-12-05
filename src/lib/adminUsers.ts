import { redis } from "./redis";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const ADMIN_USERS_PREFIX = "admin:user:";
const ADMIN_USERS_INDEX = "admin:users:index";

export interface AdminUser {
  id: string; // UUID
  email: string;
  passwordHash: string;
  twoFactorSecret: string; // Mandatory - every admin must have 2FA
  twoFactorBackupCodes: string[]; // Emergency backup codes
  createdAt: string;
  lastLoginAt?: string;
  active: boolean; // Can be deactivated without deletion
  role: "super_admin" | "admin"; // Super admin can manage other admins
}

export interface AdminUserPublic {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
  active: boolean;
  role: "super_admin" | "admin";
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate 2FA secret and backup codes for a new admin
 */
export async function generateAdminTwoFactor(email: string): Promise<TwoFactorSetup> {
  const secret = authenticator.generateSecret();

  // Generate 10 backup codes
  const backupCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    backupCodes.push(code);
  }

  // Generate QR code
  const appName = "Desert Candle Works Admin";
  const otpauth = authenticator.keyuri(email, appName, secret);
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify a TOTP token for a specific admin user
 */
export async function verifyAdminTwoFactorToken(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await getAdminUser(userId);
  if (!user) return false;

  // Try as TOTP token first
  const isValidToken = authenticator.verify({
    token: token.replace(/\s/g, ""), // Remove spaces
    secret: user.twoFactorSecret,
  });

  if (isValidToken) return true;

  // Try as backup code
  const codeIndex = user.twoFactorBackupCodes.indexOf(token.toUpperCase());

  if (codeIndex !== -1) {
    // Remove used backup code
    user.twoFactorBackupCodes.splice(codeIndex, 1);
    await redis.set(`${ADMIN_USERS_PREFIX}${userId}`, user);
    return true;
  }

  return false;
}

/**
 * Create a new admin user (requires super_admin role)
 */
export async function createAdminUser(
  email: string,
  password: string,
  role: "super_admin" | "admin" = "admin"
): Promise<{ user: AdminUserPublic; twoFactorSetup: TwoFactorSetup }> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  // Check if email already exists
  const existing = await getAdminUserByEmail(email);
  if (existing) {
    throw new Error("Admin user with this email already exists");
  }

  // Validate password strength
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters long");
  }

  // Generate 2FA (mandatory)
  const twoFactorSetup = await generateAdminTwoFactor(email);

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate UUID for user ID
  const id = crypto.randomUUID();

  const user: AdminUser = {
    id,
    email: email.toLowerCase(),
    passwordHash,
    twoFactorSecret: twoFactorSetup.secret,
    twoFactorBackupCodes: twoFactorSetup.backupCodes,
    createdAt: new Date().toISOString(),
    active: true,
    role,
  };

  // Store in Redis
  await redis.set(`${ADMIN_USERS_PREFIX}${id}`, user);
  await redis.sadd(ADMIN_USERS_INDEX, id);

  return {
    user: toPublicAdminUser(user),
    twoFactorSetup,
  };
}

/**
 * Get admin user by ID
 */
export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  try {
    const data = await redis.get(`${ADMIN_USERS_PREFIX}${userId}`);
    if (!data) return null;
    return data as AdminUser;
  } catch (error) {
    console.error(`Failed to get admin user ${userId}:`, error);
    return null;
  }
}

/**
 * Get admin user by email
 */
export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  try {
    const allIds = await redis.smembers(ADMIN_USERS_INDEX);
    for (const id of allIds) {
      const user = await getAdminUser(id);
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to get admin user by email ${email}:`, error);
    return null;
  }
}

/**
 * Authenticate admin user with email/password
 */
export async function authenticateAdminUser(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const user = await getAdminUserByEmail(email);
  if (!user) return null;

  // Check if user is active
  if (!user.active) return null;

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) return null;

  return user;
}

/**
 * Update admin user's last login time
 */
export async function updateAdminLastLogin(userId: string): Promise<void> {
  const user = await getAdminUser(userId);
  if (!user) return;

  user.lastLoginAt = new Date().toISOString();
  await redis.set(`${ADMIN_USERS_PREFIX}${userId}`, user);
}

/**
 * List all admin users (public info only)
 */
export async function listAdminUsers(): Promise<AdminUserPublic[]> {
  try {
    const allIds = await redis.smembers(ADMIN_USERS_INDEX);
    const users: AdminUserPublic[] = [];

    for (const id of allIds) {
      const user = await getAdminUser(id);
      if (user) {
        users.push(toPublicAdminUser(user));
      }
    }

    // Sort by created date, newest first
    return users.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Failed to list admin users:", error);
    return [];
  }
}

/**
 * Deactivate an admin user (soft delete)
 */
export async function deactivateAdminUser(userId: string): Promise<boolean> {
  const user = await getAdminUser(userId);
  if (!user) return false;

  user.active = false;
  await redis.set(`${ADMIN_USERS_PREFIX}${userId}`, user);
  return true;
}

/**
 * Reactivate an admin user
 */
export async function reactivateAdminUser(userId: string): Promise<boolean> {
  const user = await getAdminUser(userId);
  if (!user) return false;

  user.active = true;
  await redis.set(`${ADMIN_USERS_PREFIX}${userId}`, user);
  return true;
}

/**
 * Delete an admin user permanently
 */
export async function deleteAdminUser(userId: string): Promise<boolean> {
  try {
    await redis.del(`${ADMIN_USERS_PREFIX}${userId}`);
    await redis.srem(ADMIN_USERS_INDEX, userId);
    return true;
  } catch (error) {
    console.error(`Failed to delete admin user ${userId}:`, error);
    return false;
  }
}

/**
 * Change admin user password
 */
export async function changeAdminPassword(
  userId: string,
  newPassword: string
): Promise<boolean> {
  if (newPassword.length < 12) {
    throw new Error("Password must be at least 12 characters long");
  }

  const user = await getAdminUser(userId);
  if (!user) return false;

  user.passwordHash = await hashPassword(newPassword);
  await redis.set(`${ADMIN_USERS_PREFIX}${userId}`, user);
  return true;
}

/**
 * Regenerate 2FA for an admin user (emergency reset)
 */
export async function regenerateAdminTwoFactor(
  userId: string
): Promise<TwoFactorSetup | null> {
  const user = await getAdminUser(userId);
  if (!user) return null;

  const twoFactorSetup = await generateAdminTwoFactor(user.email);

  user.twoFactorSecret = twoFactorSetup.secret;
  user.twoFactorBackupCodes = twoFactorSetup.backupCodes;

  await redis.set(`${ADMIN_USERS_PREFIX}${userId}`, user);

  return twoFactorSetup;
}

/**
 * Get remaining backup codes for an admin user
 */
export async function getAdminBackupCodes(userId: string): Promise<string[]> {
  const user = await getAdminUser(userId);
  if (!user) return [];
  return user.twoFactorBackupCodes;
}

/**
 * Check if any super admin exists
 */
export async function hasSuperAdmin(): Promise<boolean> {
  const users = await listAdminUsers();
  return users.some(u => u.role === "super_admin" && u.active);
}

/**
 * Convert AdminUser to public-safe version (no sensitive data)
 */
function toPublicAdminUser(user: AdminUser): AdminUserPublic {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    active: user.active,
    role: user.role,
  };
}
