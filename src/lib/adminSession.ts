import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { redis } from "./redis";

const SESSIONS_PREFIX = "admin:session:";
const COOKIE_NAME = "admin_session";

function ttl() {
  const s = Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "604800");
  return Math.max(60, Math.min(60*60*24*30, s)); // clamp 1 min .. 30 days
}

export async function createAdminSession() {
  const token = randomUUID();
  await redis.set(SESSIONS_PREFIX + token, "1", { ex: ttl() });
  (await cookies()).set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
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
  const ok = await redis.get(SESSIONS_PREFIX + token);
  return Boolean(ok);
}