// User session management using cookies and Redis
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "user_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

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
  const session: UserSession = {
    userId,
    email,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`user:session:${token}`, session, { ex: SESSION_TTL_SECONDS });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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

  const session = await kv.get<UserSession>(`user:session:${token}`);
  return session;
}

/**
 * Destroy user session (logout)
 */
export async function destroyUserSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await kv.del(`user:session:${token}`);
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
