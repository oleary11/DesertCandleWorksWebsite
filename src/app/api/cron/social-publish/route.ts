import { NextRequest, NextResponse } from "next/server";
import { advanceAllGenerating } from "@/lib/social/pipeline";
import { publishNextInQueue } from "@/lib/social/publish";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/social-publish
 * Runs twice a day (see vercel.json) and posts the next approved post in the queue.
 * Also finishes any posts whose fal webhooks went missing.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await advanceAllGenerating().catch((err) => console.error("[Cron] social advance failed:", err));

  try {
    const post = await publishNextInQueue();
    if (!post) return NextResponse.json({ ok: true, published: 0, message: "Queue is empty" });
    return NextResponse.json({ ok: true, published: 1, id: post.id, status: post.status, error: post.error });
  } catch (err) {
    console.error("[Cron] social publish failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Publish failed" }, { status: 500 });
  }
}
