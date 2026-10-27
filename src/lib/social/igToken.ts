// The Instagram Login token (INSTAGRAM_POST_ACCESS_TOKEN) lasts 60 days unless renewed.
// It's renewed weekly from the social-publish cron and the renewed token is kept in KV,
// so posting and the homepage feed keep working without pasting a new token every two months.

import { kv } from "@vercel/kv";

const TOKEN_KEY = "instagram:token";
const REFRESHED_KEY = "instagram:token:refreshed_at";
const REFRESH_EVERY_MS = 7 * 86_400_000;

/** The current Instagram Login token: the renewed one if we have it, else the env var. */
export async function instagramLoginToken(): Promise<string | undefined> {
  try {
    const stored = await kv.get<string>(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // KV unavailable: fall back to the env var
  }
  return process.env.INSTAGRAM_POST_ACCESS_TOKEN || undefined;
}

/** Renews the token if it hasn't been in a week. Returns what happened, for the cron log. */
export async function refreshInstagramTokenIfDue(): Promise<string> {
  const last = await kv.get<number>(REFRESHED_KEY).catch(() => null);
  if (last && Date.now() - last < REFRESH_EVERY_MS) return "not due";
  const token = await instagramLoginToken();
  if (!token) return "no token";
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!res.ok || !data.access_token) {
    console.error("[Instagram] Token renewal failed:", data.error?.message ?? res.status);
    return `failed: ${data.error?.message ?? res.status}`;
  }
  await kv.set(TOKEN_KEY, data.access_token);
  await kv.set(REFRESHED_KEY, Date.now());
  return `renewed, good for ${Math.round((data.expires_in ?? 0) / 86_400)} days`;
}
