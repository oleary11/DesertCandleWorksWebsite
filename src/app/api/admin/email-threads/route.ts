import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listThreads, replyDomain } from "@/lib/emailThreadsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/email-threads — conversations from one-to-one admin emails, newest first. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const threads = await listThreads();
    return NextResponse.json({
      threads,
      unread: threads.reduce((sum, t) => sum + t.unreadCount, 0),
      repliesConfigured: !!replyDomain(),
    });
  } catch (error) {
    console.error("[Email Threads] list failed:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
