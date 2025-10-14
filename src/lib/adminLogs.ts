import { redis } from "./redis";

const LOGS_KEY = "admin:logs";
const MAX_LOGS = 1000; // Keep last 1000 log entries

export interface AdminLogEntry {
  timestamp: string;
  action: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
  success: boolean;
}

/**
 * Log an admin action
 */
export async function logAdminAction(entry: Omit<AdminLogEntry, "timestamp">): Promise<void> {
  const logEntry: AdminLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  try {
    // Add to Redis list
    await redis.lpush(LOGS_KEY, JSON.stringify(logEntry));

    // Trim to keep only last MAX_LOGS entries
    await redis.ltrim(LOGS_KEY, 0, MAX_LOGS - 1);
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}

/**
 * Get recent admin logs
 */
export async function getAdminLogs(limit: number = 50): Promise<AdminLogEntry[]> {
  try {
    const logs = await redis.lrange(LOGS_KEY, 0, limit - 1);
    return logs.map((log) => JSON.parse(log as string));
  } catch (error) {
    console.error("Failed to get admin logs:", error);
    return [];
  }
}

/**
 * Get failed login attempts in the last hour
 */
export async function getRecentFailedLogins(hours: number = 1): Promise<number> {
  try {
    const logs = await getAdminLogs(200);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return logs.filter(
      (log) =>
        log.action === "login" &&
        !log.success &&
        new Date(log.timestamp) > cutoff
    ).length;
  } catch (error) {
    console.error("Failed to get failed login count:", error);
    return 0;
  }
}
