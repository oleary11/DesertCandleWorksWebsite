import { redis } from "@/lib/redis";

const MAX_ATTEMPTS = 5;

/**
 * Each kind of request counts separately, so e.g. a few checkouts or newsletter signups
 * from one Wi-Fi network never lock out admin sign-in (or each other). Sign-in style
 * routes keep the strict 5; everyday shopper actions get more room.
 */
export type RateLimitBucket =
  | "login"
  | "auth"
  | "checkout"
  | "subscribe"
  | "invoice"
  | "upload";

const BUCKET_LIMITS: Record<RateLimitBucket, number> = {
  login: MAX_ATTEMPTS,
  auth: 10,
  checkout: 30,
  subscribe: 10,
  invoice: 30,
  upload: 60,
};
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_SEC = 15 * 60; // 15 minutes in seconds for Redis TTL

// In-memory fallback (for development or if Redis fails)
const inMemoryAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if an IP is within rate limit
 * Uses Redis in production, falls back to in-memory for development
 */
export async function checkRateLimit(ip: string, bucket: RateLimitBucket = "login"): Promise<boolean> {
  const max = BUCKET_LIMITS[bucket];
  try {
    // Try Redis first
    const key = `rate_limit:${bucket}:${ip}`;
    const current = await redis.get(key);

    if (current === null) {
      // First attempt
      await redis.set(key, "1", { ex: LOCKOUT_DURATION_SEC });
      return true;
    }

    const count = parseInt(current as string, 10);

    if (count >= max) {
      return false;
    }

    // Increment attempt count
    await redis.incr(key);
    return true;
  } catch (error) {
    // Fallback to in-memory if Redis fails
    console.warn("Redis rate limiting failed, using in-memory fallback:", error);
    return checkRateLimitInMemory(`${bucket}:${ip}`, max);
  }
}

/**
 * Reset rate limit for an IP (admin override)
 */
export async function resetRateLimit(ip: string, bucket: RateLimitBucket = "login"): Promise<void> {
  try {
    const key = `rate_limit:${bucket}:${ip}`;
    await redis.del(key);
  } catch (error) {
    console.warn("Redis rate limit reset failed, using in-memory fallback:", error);
  }

  // Always clear in-memory fallback too
  inMemoryAttempts.delete(`${bucket}:${ip}`);
}

/**
 * In-memory rate limiting fallback
 */
function checkRateLimitInMemory(ip: string, max: number): boolean {
  const now = Date.now();
  const attempt = inMemoryAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    inMemoryAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_DURATION_MS });
    return true;
  }

  if (attempt.count >= max) {
    return false;
  }

  attempt.count++;
  return true;
}

/**
 * Get remaining lockout time in seconds (for user feedback)
 */
export async function getRemainingLockoutTime(ip: string): Promise<number | null> {
  try {
    const key = `rate_limit:login:${ip}`;
    const ttl = await redis.ttl(key);

    if (ttl > 0) {
      return ttl;
    }
    return null;
  } catch {
    // Fallback to in-memory
    const attempt = inMemoryAttempts.get(`login:${ip}`);
    if (attempt && attempt.count >= MAX_ATTEMPTS) {
      const remaining = Math.max(0, attempt.resetAt - Date.now());
      return Math.ceil(remaining / 1000);
    }
    return null;
  }
}
