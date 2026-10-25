import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getLoggedEmail } from "@/lib/emailLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET — one of our logged emails with its content (our own copy; Resend only as a fallback). */
export async function GET(_: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    // Only emails in our log: the Resend account also holds other projects' mail.
    const email = await getLoggedEmail(id);
    if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });
    return NextResponse.json({
      email: {
        resendId: email.resendId,
        toEmail: email.toEmail,
        fromEmail: email.fromEmail,
        subject: email.subject,
        category: email.category,
        orderId: email.orderId,
        lastEvent: email.lastEvent,
        sentAt: email.sentAt,
        replyTo: email.replyTo ? email.replyTo.split(", ") : [],
        html: email.htmlBody,
        text: email.textBody,
      },
    });
  } catch (error) {
    console.error("[Email Log] open failed:", error);
    return NextResponse.json({ error: "Could not load this email" }, { status: 500 });
  }
}
