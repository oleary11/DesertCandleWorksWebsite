import { redis } from "@/lib/redis";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_SEC = 15 * 60; // 15 minutes in seconds for Redis TTL

// In-memory fallback (for development or if Redis fails)
const inMemoryAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if an IP is within rate limit
 * Uses Redis in production, falls back to in-memory for development
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    // Try Redis first
    const key = `rate_limit:login:${ip}`;
    const current = await redis.get(key);

    if (current === null) {
      // First attempt
      await redis.set(key, "1", { ex: LOCKOUT_DURATION_SEC });
      return true;
    }

    const count = parseInt(current as string, 10);

    if (count >= MAX_ATTEMPTS) {
      return false;
    }

    // Increment attempt count
    await redis.incr(key);
    return true;
  } catch (error) {
    // Fallback to in-memory if Redis fails
    console.warn("Redis rate limiting failed, using in-memory fallback:", error);
    return checkRateLimitInMemory(ip);
  }
}

/**
 * Reset rate limit for an IP (admin override)
 */
export async function resetRateLimit(ip: string): Promise<void> {
  try {
    const key = `rate_limit:login:${ip}`;
    await redis.del(key);
  } catch (error) {
    console.warn("Redis rate limit reset failed, using in-memory fallback:", error);
  }

  // Always clear in-memory fallback too
  inMemoryAttempts.delete(ip);
}

/**
 * In-memory rate limiting fallback
 */
function checkRateLimitInMemory(ip: string): boolean {
  const now = Date.now();
  const attempt = inMemoryAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    inMemoryAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_DURATION_MS });
    return true;
  }

  if (attempt.count >= MAX_ATTEMPTS) {
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
    const attempt = inMemoryAttempts.get(ip);
    if (attempt && attempt.count >= MAX_ATTEMPTS) {
      const remaining = Math.max(0, attempt.resetAt - Date.now());
      return Math.ceil(remaining / 1000);
    }
    return null;
  }
}
