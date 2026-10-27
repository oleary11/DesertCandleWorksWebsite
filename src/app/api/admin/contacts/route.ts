import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listContacts } from "@/lib/contacts";
import { addUnsubscribe, removeUnsubscribe } from "@/lib/unsubscribe";
import { cancelScheduledFor } from "@/lib/scheduledEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/contacts — everyone we can email, merged from every source. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await listContacts());
  } catch (error) {
    console.error("[Contacts] list failed:", error);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

/** POST { email, subscribed } — admin marks someone as unsubscribed (or undoes it). */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string; subscribed?: boolean };
  if (!body.email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (body.subscribed) await removeUnsubscribe(body.email);
  else {
    await addUnsubscribe(body.email, "admin");
    await cancelScheduledFor(body.email).catch((err) => console.error("[Contacts] Cancelling scheduled emails failed:", err));
  }
  return NextResponse.json({ ok: true });
}
