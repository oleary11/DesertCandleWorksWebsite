import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthed } from "@/lib/adminSession";
import { db } from "@/lib/db/client";
import { emailLog } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET — the full email (HTML, text, status) from Resend, for one of our logged emails. */
export async function GET(_: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  // Only open emails in our log: the Resend account also holds other projects' mail.
  const [logged] = await db.select().from(emailLog).where(eq(emailLog.resendId, id));
  if (!logged) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Resend could not load this email (${res.status})` }, { status: 502 });
  }
  const email = (await res.json()) as {
    html?: string | null;
    text?: string | null;
    last_event?: string | null;
    reply_to?: string[] | null;
  };

  if (email.last_event && email.last_event !== logged.lastEvent) {
    await db.update(emailLog).set({ lastEvent: email.last_event }).where(eq(emailLog.resendId, id));
  }

  return NextResponse.json({
    email: {
      ...logged,
      lastEvent: email.last_event ?? logged.lastEvent,
      replyTo: email.reply_to ?? [],
      html: email.html ?? null,
      text: email.text ?? null,
    },
  });
}
