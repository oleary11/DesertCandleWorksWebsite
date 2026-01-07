import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { adminSessions } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";

const COOKIE_NAME = "admin_session";
const isProd = process.env.NODE_ENV === "production";

export interface AdminSession {
  userId: string;
  email: string;
  role: "super_admin" | "admin";
  createdAt: string;
}

function ttlSeconds() {
  const s = Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "604800");
  return Math.max(60, Math.min(60 * 60 * 24 * 30, s)); // clamp 1 min .. 30 days
}

function buildCookie(maxAge: number) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProd,          // ✅ http dev (LAN/localhost) works; https prod stays secure
    sameSite: "lax" as const, // ✅ avoid dev/login edge cases
    path: "/",
    maxAge,
    // ✅ do NOT set domain for LAN/IP dev
    // domain: isProd ? ".desertcandleworks.com" : undefined,
  };
}

export async function createAdminSession(
  userId: string,
  email: string,
  role: "super_admin" | "admin"
) {
  const token = randomUUID();
  const now = new Date();
  const maxAge = ttlSeconds();
  const expiresAt = new Date(now.getTime() + maxAge * 1000);

  await db.insert(adminSessions).values({
    token,
    userId,
    email,
    role,
    expiresAt,
  });

  const c = await cookies();
  c.set({
    ...buildCookie(maxAge),
    value: token,
  });
}

export async function destroyAdminSession() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;

  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }

  // Delete cookie reliably (path must match)
  c.set({
    ...buildCookie(0),
    value: "",
    maxAge: 0,
  });
}

export async function isAdminAuthed(): Promise<boolean> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.token, token))
    .limit(1);

  if (!session) return false;

  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
    return false;
  }

  return true;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.token, token))
    .limit(1);

  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
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