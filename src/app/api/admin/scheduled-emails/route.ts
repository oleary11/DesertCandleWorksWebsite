import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listScheduledEmails } from "@/lib/scheduledEmails";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ scheduled: await listScheduledEmails() });
  } catch (error) {
    console.error("[Scheduled Email] List failed:", error);
    return NextResponse.json({ error: "Couldn't load scheduled emails" }, { status: 500 });
  }
}
