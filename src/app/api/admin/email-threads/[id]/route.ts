import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { sendAdminMessage } from "@/lib/adminMessages";
import { logAdminAction } from "@/lib/adminLogs";
import { getThread, getThreadMessages, latestInboundMessageId, markThreadRead } from "@/lib/emailThreadsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET — the conversation and its messages; opening it marks it read. */
export async function GET(_: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const thread = await getThread(id);
  if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const messages = await getThreadMessages(id);
  await markThreadRead(id);
  return NextResponse.json({ thread: { ...thread, unreadCount: 0 }, messages });
}

/** POST { message, personal } — answer the customer in the same conversation. */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const thread = await getThread(id);
  if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { message?: string; personal?: boolean };
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  const personal = body.personal ?? thread.personal;

  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
  try {
    await sendAdminMessage({
      to: thread.customerEmail,
      subject,
      message,
      personal,
      threadId: id,
      inReplyTo: await latestInboundMessageId(id),
    });
    await markThreadRead(id);
    await logAdminAction({
      action: "email.reply",
      adminEmail: "admin",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
      success: true,
      details: { threadId: id, to: thread.customerEmail, personal },
    });
    return NextResponse.json({ success: true, messages: await getThreadMessages(id) });
  } catch (error) {
    console.error("[Email Threads] reply failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send reply" }, { status: 500 });
  }
}
