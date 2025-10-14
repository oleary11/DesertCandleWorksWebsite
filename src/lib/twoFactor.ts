import { authenticator } from "otplib";
import { redis } from "./redis";
import QRCode from "qrcode";

const SECRET_KEY = "admin:2fa:secret";
const BACKUP_CODES_KEY = "admin:2fa:backup_codes";

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Generate a new 2FA secret and backup codes
 */
export async function generateTwoFactorSecret(): Promise<TwoFactorSetup> {
  const secret = authenticator.generateSecret();

  // Generate 10 backup codes
  const backupCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    backupCodes.push(code);
  }

  // Store in Redis
  await redis.set(SECRET_KEY, secret);
  await redis.set(BACKUP_CODES_KEY, JSON.stringify(backupCodes));

  // Generate QR code
  const appName = "Desert Candle Works";
  const otpauth = authenticator.keyuri("admin", appName, secret);
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify a TOTP token or backup code
 */
export async function verifyTwoFactorToken(token: string): Promise<boolean> {
  const secret = await redis.get(SECRET_KEY);
  if (!secret) return false;

  // Try as TOTP token first
  const isValidToken = authenticator.verify({
    token: token.replace(/\s/g, ""), // Remove spaces
    secret: secret as string,
  });

  if (isValidToken) return true;

  // Try as backup code
  const backupCodesStr = await redis.get(BACKUP_CODES_KEY);
  if (!backupCodesStr) return false;

  const backupCodes: string[] = JSON.parse(backupCodesStr as string);
  const codeIndex = backupCodes.indexOf(token.toUpperCase());

  if (codeIndex !== -1) {
    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    await redis.set(BACKUP_CODES_KEY, JSON.stringify(backupCodes));
    return true;
  }

  return false;
}

/**
 * Check if 2FA is enabled
 */
export async function isTwoFactorEnabled(): Promise<boolean> {
  const secret = await redis.get(SECRET_KEY);
  return Boolean(secret);
}

/**
 * Disable 2FA
 */
export async function disableTwoFactor(): Promise<void> {
  await redis.del(SECRET_KEY);
  await redis.del(BACKUP_CODES_KEY);
}

/**
 * Get remaining backup codes
 */
export async function getBackupCodes(): Promise<string[]> {
  const backupCodesStr = await redis.get(BACKUP_CODES_KEY);
  if (!backupCodesStr) return [];
  return JSON.parse(backupCodesStr as string);
}
