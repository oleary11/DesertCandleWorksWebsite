import { NextRequest, NextResponse } from "next/server";
import { createBatch } from "@/lib/social/pipeline";
import { isFalConfigured } from "@/lib/social/fal";
import { isOpenAIConfigured } from "@/lib/social/content";

export const runtime = "nodejs";
export const maxDuration = 300;

// 2 posts a day = 14 a week. Reels (2 a week) are started by hand from admin, so the weekly batch
// fills the other 12.
const WEEKLY_SLIDESHOWS = 8;
const WEEKLY_MEMES = 4;

/**
 * GET /api/cron/social-generate
 * Weekly: drafts next week's slideshows and memes into the review queue in /admin/social.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFalConfigured() || !isOpenAIConfigured()) {
    return NextResponse.json({ error: "FAL_KEY and OPENAI_API_KEY must both be configured" }, { status: 500 });
  }

  try {
    const posts = await createBatch(WEEKLY_SLIDESHOWS, WEEKLY_MEMES);
    return NextResponse.json({ ok: true, generated: posts.length });
  } catch (err) {
    console.error("[Cron] social generate failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generate failed" }, { status: 500 });
  }
}
