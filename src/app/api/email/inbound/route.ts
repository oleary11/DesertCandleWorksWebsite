import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { DEFAULT_BASE_URL, escapeHtml } from "@/lib/emailLayout";
import {
  addMessage,
  getThread,
  latestThreadForCustomer,
  replyDomain,
  threadIdFromAddresses,
} from "@/lib/emailThreadsStore";

export const runtime = "nodejs";

// Resend "email.received" webhook: a customer replied to a one-to-one email from
// /admin/emails (Reply-To reply+{threadId}@EMAIL_REPLY_DOMAIN). We fetch the body,
// file it under the conversation, and give contact@ a heads-up.
//
// Setup: Resend → Domains → enable Receiving on EMAIL_REPLY_DOMAIN and add its MX record;
// Resend → Webhooks → endpoint https://www.desertcandleworks.com/api/email/inbound with
// event email.received; put the signing secret in RESEND_INBOUND_WEBHOOK_SECRET.

type ReceivedEvent = {
  type: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    received_for?: string[];
    message_id?: string;
    subject?: string;
  };
};

type ReceivedEmail = {
  id: string;
  from: string;
  to?: string[];
  received_for?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
};

const NOTIFY_ADDRESS = "contact@desertcandleworks.com";

/** Svix-style signature check (svix-id / svix-timestamp / svix-signature, secret "whsec_..."). */
function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Inbound Email] RESEND_INBOUND_WEBHOOK_SECRET is not set; rejecting webhook");
    return false;
  }
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signatures = req.headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

function bareAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

function htmlToText(html: string): string {
  let source = html;
  if (source.startsWith("data:")) {
    const comma = source.indexOf(",");
    const meta = source.slice(0, comma);
    const payload = source.slice(comma + 1);
    source = meta.includes(";base64") ? Buffer.from(payload, "base64").toString("utf8") : decodeURIComponent(payload);
  }
  return source
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

/** Drops the quoted copy of our email that mail clients append under a reply. */
function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (line, i) =>
      /^On .+wrote:\s*$/i.test(line) ||
      // Gmail wraps long "On … wrote:" lines
      (/^On .+/i.test(line) && /wrote:\s*$/i.test(lines[i + 1] ?? "")) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(line) ||
      /^_{5,}\s*$/.test(line) ||
      (/^From: .+/i.test(line) && /^(Sent|Date): /i.test(lines[i + 1] ?? ""))
  );
  const kept = (cut >= 0 ? lines.slice(0, cut) : lines).filter((line) => !line.startsWith(">"));
  const result = kept.join("\n").trim();
  return result || text.trim();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as ReceivedEvent;
  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ignored: true });
  }

  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.data.email_id)}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!res.ok) {
    console.error("[Inbound Email] Could not fetch received email:", res.status, await res.text());
    return NextResponse.json({ error: "Could not fetch email" }, { status: 502 }); // Resend retries
  }
  const email = (await res.json()) as ReceivedEmail;

  const fromEmail = bareAddress(email.from || event.data.from || "");
  const addresses = [...(email.to ?? event.data.to ?? []), ...(email.received_for ?? event.data.received_for ?? [])];

  // Resend sends every received email on the account (other domains too) to every
  // email.received webhook, so only take mail addressed to our reply domain.
  const domain = replyDomain();
  if (!domain || !addresses.some((a) => bareAddress(a).endsWith(`@${domain}`))) {
    return NextResponse.json({ ignored: true });
  }

  const threadId = threadIdFromAddresses(addresses);
  const thread = (threadId && (await getThread(threadId))) || (fromEmail ? await latestThreadForCustomer(fromEmail) : null);
  if (!thread) {
    console.warn(`[Inbound Email] No conversation for mail from ${fromEmail} to ${addresses.join(", ")}`);
    return NextResponse.json({ ignored: true });
  }

  const fullText = email.text?.trim() ? email.text : email.html ? htmlToText(email.html) : "";
  const bodyText = stripQuoted(fullText);
  const saved = await addMessage({
    threadId: thread.id,
    direction: "in",
    fromEmail,
    subject: email.subject || event.data.subject || "",
    bodyText,
    messageId: email.message_id || event.data.message_id,
    resendId: email.id || event.data.email_id,
  });
  if (!saved) return NextResponse.json({ duplicate: true });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const link = `${baseUrl}/admin/emails?thread=${thread.id}`;
  const who = thread.customerName ? `${thread.customerName} (${fromEmail})` : fromEmail;
  try {
    await sendEmail({
      to: NOTIFY_ADDRESS,
      subject: `New reply from ${thread.customerName || fromEmail}: ${thread.subject}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#211a16;">
        <p><strong>${escapeHtml(who)}</strong> replied to “${escapeHtml(thread.subject)}”:</p>
        <blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #b97835;background:#f7f2eb;white-space:pre-wrap;">${escapeHtml(bodyText)}</blockquote>
        <p><a href="${escapeHtml(link)}" style="color:#8f5520;font-weight:700;">Open the conversation in admin</a></p>
      </div>`,
      text: `${who} replied to "${thread.subject}":\n\n${bodyText}\n\nOpen the conversation: ${link}`,
      category: "notification",
    });
  } catch (err) {
    console.error("[Inbound Email] Notification failed:", err);
  }

  return NextResponse.json({ ok: true });
}
