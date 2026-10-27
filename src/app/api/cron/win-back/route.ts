import { NextRequest, NextResponse } from "next/server";
import { runWinBack } from "@/lib/winBack";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/win-back
 * Daily: "we miss you" email with a single-use 15% off code to customers whose last order
 * was about 90 days ago. ?dryRun=1 counts who would be emailed without sending. Set
 * WIN_BACK_DISABLED=1 to pause.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized win-back attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.WIN_BACK_DISABLED === "1") return NextResponse.json({ skipped: "WIN_BACK_DISABLED" });
  try {
    const result = await runWinBack({ dryRun: req.nextUrl.searchParams.get("dryRun") === "1" });
    console.log(`[Cron] Win-back: ${result.sent} sent, ${result.failed} failed, ${result.due} due`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron] Win-back failed:", error);
    return NextResponse.json({ error: "Win-back failed" }, { status: 500 });
  }
}
