import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { dbHttp } from "@/lib/db/client";
import { pageViews, analyticsEvents } from "@/lib/db/schema";

export const runtime = "nodejs";

// Page views: 120/min per IP (generous for real users, still blocks scrapers)
// Cart/checkout events: no rate limit — they're infrequent and must never be dropped
const PAGE_VIEW_RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW = 60; // seconds

// Known bot user-agent substrings — skip recording these
const BOT_PATTERNS = [
  "googlebot",
  "bingbot",
  "slurp",       // Yahoo
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "sogou",
  "exabot",
  "facebookexternalhit",
  "ia_archiver",  // Wayback Machine
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "rogerbot",
  "petalbot",
  "gptbot",
  "claudebot",
  "anthropic-ai",
  "ccbot",
  "spider",
  "crawler",
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((pattern) => ua.includes(pattern));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, eventType, path, referrer, properties } = body as {
      sessionId?: string;
      eventType?: string;
      path?: string;
      referrer?: string;
      properties?: Record<string, unknown>;
    };

    // Basic input validation
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!eventType || typeof eventType !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Don't track admin or API paths
    if (path && (path.startsWith("/admin") || path.startsWith("/api"))) {
      return NextResponse.json({ ok: true });
    }

    // Skip known bots
    const userAgent = req.headers.get("user-agent") || "";
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Rate limit page views only — cart/checkout events are never rate-limited
    if (eventType === "page_view") {
      const rateLimitKey = `analytics:rate:${ip}`;
      const attempts = (await kv.get<number>(rateLimitKey)) || 0;
      if (attempts >= PAGE_VIEW_RATE_LIMIT) {
        return NextResponse.json({ ok: false }, { status: 429 });
      }
      await kv.incr(rateLimitKey);
      await kv.expire(rateLimitKey, RATE_LIMIT_WINDOW);
    }

    // Extract geo data from Vercel headers (free, no external service needed)
    const country = req.headers.get("x-vercel-ip-country") || null;
    const region = req.headers.get("x-vercel-ip-country-region") || null;
    const city = req.headers.get("x-vercel-ip-city") || null;

    if (eventType === "page_view") {
      const cleanPath = path ? path.substring(0, 500) : "/";
      const cleanReferrer = referrer ? referrer.substring(0, 500) : null;

      await dbHttp.insert(pageViews).values({
        sessionId: sessionId.substring(0, 64),
        path: cleanPath,
        referrer: cleanReferrer,
        country,
        region,
        city,
      });
    } else {
      // Cart/checkout events go into analyticsEvents
      await dbHttp.insert(analyticsEvents).values({
        sessionId: sessionId.substring(0, 64),
        eventType: eventType.substring(0, 50),
        properties: properties || null,
        country,
        region,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Silently fail — tracking should never break the user experience
    console.error("[Analytics Track] Error:", error);
    return NextResponse.json({ ok: true });
  }
}
