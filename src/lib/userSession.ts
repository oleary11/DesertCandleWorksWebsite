// User session management using cookies and Postgres
import { db } from "@/lib/db/client";
import { userSessions } from "@/lib/db/schema";
import { cookies } from "next/headers";
import crypto from "crypto";
import { eq, lt } from "drizzle-orm";

const SESSION_COOKIE_NAME = "user_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const isProd = process.env.NODE_ENV === "production";

export type UserSession = {
  userId: string;
  email: string;
  createdAt: string;
};

/**
 * Create a new user session
 */
export async function createUserSession(userId: string, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await db.insert(userSessions).values({
    token,
    userId,
    email,
    expiresAt,
  });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // HTTPS in production, allow HTTP in development
    sameSite: "strict", // Strong CSRF protection
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return token;
}

/**
 * Get current user session from cookie
 */
export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.token, token))
    .limit(1);

  if (!session) return null;

  // Check if session has expired
  if (new Date(session.expiresAt) < new Date()) {
    // Clean up expired session
    await db.delete(userSessions).where(eq(userSessions.token, token));
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
    createdAt: session.createdAt.toISOString(),
  };
}

/**
 * Destroy user session (logout)
 */
export async function destroyUserSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.delete(userSessions).where(eq(userSessions.token, token));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if user is authenticated
 */
export async function isUserAuthed(): Promise<boolean> {
  const session = await getUserSession();
  return session !== null;
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getUserSession();
  return session?.userId ?? null;
}

/**
 * Require authentication (throw if not authenticated)
 */
export async function requireAuth(): Promise<UserSession> {
  const session = await getUserSession();
  if (!session) {
    throw new Error("Authentication required");
  }
  return session;
}

/**
 * Clean up expired sessions (call periodically via cron)
 */
export async function cleanupExpiredUserSessions(): Promise<number> {
  const result = await db
    .delete(userSessions)
    .where(lt(userSessions.expiresAt, new Date()));

  return result.rowCount ?? 0;
}
