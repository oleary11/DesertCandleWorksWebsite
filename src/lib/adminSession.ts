import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { adminSessions } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";

const COOKIE_NAME = "admin_session";

export interface AdminSession {
  userId: string;
  email: string;
  role: "super_admin" | "admin";
  createdAt: string;
}

function ttl() {
  const s = Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "604800");
  return Math.max(60, Math.min(60*60*24*30, s)); // clamp 1 min .. 30 days
}

export async function createAdminSession(userId: string, email: string, role: "super_admin" | "admin") {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl() * 1000);

  await db.insert(adminSessions).values({
    token,
    userId,
    email,
    role,
    expiresAt,
  });

  (await cookies()).set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "strict", // Upgrade from "lax" for better CSRF protection
    path: "/",
    maxAge: ttl(),
  });
}

export async function destroyAdminSession() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }
  c.delete(COOKIE_NAME);
}

export async function isAdminAuthed(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.token, token))
    .limit(1);

  if (!session) return false;

  // Check if session has expired
  if (new Date(session.expiresAt) < new Date()) {
    // Clean up expired session
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
    return false;
  }

  return true;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.token, token))
    .limit(1);

  if (!session) return null;

  // Check if session has expired
  if (new Date(session.expiresAt) < new Date()) {
    // Clean up expired session
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
    role: session.role as "super_admin" | "admin",
    createdAt: session.createdAt.toISOString(),
  };
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || session.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }
  return session;
}

/**
 * Clean up expired sessions (call periodically via cron)
 */
export async function cleanupExpiredAdminSessions(): Promise<number> {
  const result = await db
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, new Date()));

  return result.rowCount ?? 0;
}
