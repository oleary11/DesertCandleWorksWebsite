import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listEmailLog, syncFromResend, syncRecentFromResend } from "@/lib/emailLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET ?category=&status=&q=&offset= — sent emails, newest first (refreshes recent ones from Resend). */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = req.nextUrl.searchParams;
  try {
    await syncRecentFromResend();
    const result = await listEmailLog({
      category: params.get("category") || undefined,
      status: params.get("status") || undefined,
      q: params.get("q") || undefined,
      offset: Number(params.get("offset")) || 0,
      limit: 50,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Email Log] list failed:", error);
    return NextResponse.json({ error: "Failed to load sent emails" }, { status: 500 });
  }
}

/** POST — pull older history from Resend (up to ~5,000 account emails per run). */
export async function POST() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncFromResend({ maxPages: 50 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Email Log] full sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
