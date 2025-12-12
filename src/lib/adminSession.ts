import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { redis } from "./redis";

const SESSIONS_PREFIX = "admin:session:";
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
  const session: AdminSession = {
    userId,
    email,
    role,
    createdAt: new Date().toISOString(),
  };

  await redis.set(SESSIONS_PREFIX + token, session, { ex: ttl() });
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
  if (token) await redis.del(SESSIONS_PREFIX + token);
  c.delete(COOKIE_NAME);
}

export async function isAdminAuthed(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const session = await redis.get(SESSIONS_PREFIX + token);
  return Boolean(session);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await redis.get(SESSIONS_PREFIX + token);
  if (!session) return null;

  return session as AdminSession;
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || session.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }
  return session;
}