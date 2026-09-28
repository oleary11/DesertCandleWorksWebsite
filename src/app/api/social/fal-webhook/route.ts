import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { webhookToken } from "@/lib/social/fal";
import { advancePost } from "@/lib/social/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/social/fal-webhook?post=<id>&token=<hmac>
// fal calls this when one of a post's jobs finishes. The payload itself is ignored: advancePost
// re-reads every job's status from fal, so a forged call can at most trigger a harmless re-check.
export async function POST(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("post") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expected = webhookToken(postId);
  if (!postId || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await advancePost(postId);
  } catch (err) {
    console.error(`[social] webhook advance ${postId} failed:`, err);
  }
  // Always 200 so fal doesn't retry; the admin page and cron re-check anything left behind.
  return NextResponse.json({ ok: true });
}
