import { NextRequest, NextResponse } from "next/server";
import { runReviewRequests } from "@/lib/reviewRequests";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/review-requests
 * Daily: asks customers for a Google review a few days after their order was delivered.
 * ?dryRun=1 lists who would be emailed without sending. Set REVIEW_REQUESTS_DISABLED=1 to pause.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized review-requests attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.REVIEW_REQUESTS_DISABLED === "1") {
    return NextResponse.json({ skipped: "REVIEW_REQUESTS_DISABLED" });
  }

  try {
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
    const result = await runReviewRequests({ dryRun });
    console.log(`[Cron] Review requests: ${result.sent} sent, ${result.failed} failed, ${result.candidates.length} due`);
    return NextResponse.json({
      ...result,
      candidates: result.candidates.map((c) => ({ orderId: c.orderId, deliveredAt: c.deliveredAt })),
    });
  } catch (error) {
    console.error("[Cron] Review requests failed:", error);
    return NextResponse.json({ error: "Review requests failed" }, { status: 500 });
  }
}
