import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { cancelScheduledEmail, rescheduleScheduledEmail, scheduledEmailHtml } from "@/lib/scheduledEmails";

export const runtime = "nodejs";

/** The email as it will arrive, for the preview. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const html = await scheduledEmailHtml(id);
  if (!html) return NextResponse.json({ error: "No copy of this email was saved" }, { status: 404 });
  return NextResponse.json({ html });
}

/** PATCH { scheduleAt }: moves it to a new time. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { scheduleAt?: string };
  try {
    await rescheduleScheduledEmail(id, new Date(body.scheduleAt ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

/** Cancels a scheduled send that hasn't gone out yet. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const result = await cancelScheduledEmail(id);
    if (result.failed > 0) {
      return NextResponse.json(
        { error: `Cancelled ${result.cancelled}, but ${result.failed} couldn't be cancelled (they may already be sending)`, ...result },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
