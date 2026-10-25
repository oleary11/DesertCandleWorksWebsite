// Log of every Desert Candle Works email sent through Resend, for the "Sent" tab in
// /admin/emails. The Resend account is shared with other projects, so we keep our own
// list: each send is recorded by lib/email.ts, and syncFromResend() fills in anything
// sent elsewhere (e.g. Gmail through Resend SMTP) and refreshes delivery status.

import { and, desc, eq, ilike, or, sql as dsql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailLog } from "@/lib/db/schema";

export type EmailLogEntry = typeof emailLog.$inferSelect;

export type EmailCategory =
  | "order"
  | "shipping"
  | "delivered"
  | "refund"
  | "account"
  | "message"
  | "personal"
  | "notification"
  | "other";

// Same as drizzle/0014_email_log.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "email_log" (
    "resend_id" varchar(100) PRIMARY KEY,
    "to_email" text NOT NULL DEFAULT '',
    "from_email" text NOT NULL DEFAULT '',
    "subject" text NOT NULL DEFAULT '',
    "category" varchar(30) NOT NULL DEFAULT 'other',
    "order_id" varchar(100),
    "last_event" varchar(30),
    "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "email_log_sent_at_idx" ON "email_log" ("sent_at")`,
  `CREATE INDEX IF NOT EXISTS "email_log_category_idx" ON "email_log" ("category")`,
  `CREATE INDEX IF NOT EXISTS "email_log_order_idx" ON "email_log" ("order_id")`,
];

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    for (const statement of ENSURE_STATEMENTS) await db.execute(dsql.raw(statement));
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

const OUR_DOMAIN = /@(?:[a-z0-9-]+\.)*desertcandleworks\.com>?\s*$/i;

/** Type and order number from the subject lines our email code writes. */
export function classifyEmail(
  subject: string,
  from: string,
  replyTo: string[] = []
): { category: EmailCategory; orderId: string | null } {
  const candidate =
    subject.match(/#([A-Za-z0-9_-]{3,})/)?.[1] ??
    subject.match(/Order confirmed:\s*([A-Za-z0-9_-]{3,})/i)?.[1] ??
    subject.match(/·\s*([A-Za-z0-9_-]{3,})\s*$/)?.[1] ??
    subject.match(/\border\s+([A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)\s*$/i)?.[1] ??
    null;
  // Order numbers always contain digits; this drops words caught by the patterns above.
  const orderId = candidate && /\d/.test(candidate) ? candidate : null;

  let category: EmailCategory = "other";
  if (/order confirm/i.test(subject)) category = "order";
  else if (/on the way|has shipped/i.test(subject)) category = "shipping";
  else if (/delivered/i.test(subject)) category = "delivered";
  else if (/refund/i.test(subject)) category = "refund";
  else if (/reset your password|verify your email/i.test(subject)) category = "account";
  else if (/^new reply from/i.test(subject)) category = "notification";
  // Only emails written on /admin/emails carry a reply+{conversation}@ Reply-To.
  else if (replyTo.some((address) => /reply\+[^@]+@/i.test(address))) category = "message";
  else if (/^\s*(re|fwd?):/i.test(subject) || /contact@desertcandleworks\.com/i.test(from)) category = "personal";

  return { category, orderId };
}

/** Called by lib/email.ts right after Resend accepts an email. Never throws. */
export async function logSentEmail(input: {
  resendId: string;
  to: string;
  from: string;
  subject: string;
  category?: EmailCategory;
  orderId?: string | null;
}): Promise<void> {
  try {
    await ensureTable();
    const guessed = classifyEmail(input.subject, input.from);
    const category = input.category ?? guessed.category;
    const orderId = input.orderId ?? guessed.orderId;
    await db
      .insert(emailLog)
      .values({
        resendId: input.resendId,
        toEmail: input.to,
        fromEmail: input.from,
        subject: input.subject,
        category,
        orderId,
        lastEvent: "sent",
      })
      .onConflictDoUpdate({
        target: emailLog.resendId,
        set: { category, orderId, updatedAt: dsql`now()` },
      });
  } catch (err) {
    console.error("[Email Log] Could not record sent email:", err);
  }
}

type ResendListedEmail = {
  id: string;
  to: string[] | null;
  from: string;
  subject: string;
  created_at: string;
  last_event: string | null;
  reply_to: string[] | null;
};

/** Resend writes "2026-10-25 15:25:00.123+00"; JS needs "T" and a "+00:00" offset. */
function resendDate(value: string): Date {
  const date = new Date(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pages through Resend's sent-email list (newest first), adding our emails that are
 * missing and refreshing the status of the ones we have. Stops at `stopBefore`.
 */
export async function syncFromResend(options: { stopBefore?: Date; maxPages?: number } = {}): Promise<{ pages: number; seen: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { pages: 0, seen: 0 };
  await ensureTable();

  const maxPages = options.maxPages ?? 5;
  let after: string | undefined;
  let pages = 0;
  let seen = 0;

  while (pages < maxPages) {
    if (pages > 0) await sleep(600); // Resend allows a few requests per second
    const url = new URL("https://api.resend.com/emails");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`Resend list failed: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as { data: ResendListedEmail[]; has_more: boolean };
    pages++;

    const ours = page.data.filter((email) => OUR_DOMAIN.test(email.from));
    seen += ours.length;
    if (ours.length > 0) {
      await db
        .insert(emailLog)
        .values(
          ours.map((email) => {
            const { category, orderId } = classifyEmail(email.subject ?? "", email.from, email.reply_to ?? []);
            return {
              resendId: email.id,
              toEmail: (email.to ?? []).join(", "),
              fromEmail: email.from,
              subject: email.subject ?? "",
              category,
              orderId,
              lastEvent: email.last_event,
              sentAt: resendDate(email.created_at),
            };
          })
        )
        .onConflictDoUpdate({
          target: emailLog.resendId,
          set: { lastEvent: dsql`excluded.last_event`, sentAt: dsql`excluded.sent_at`, updatedAt: dsql`now()` },
        });
    }

    const last = page.data[page.data.length - 1];
    if (!page.has_more || !last) break;
    if (options.stopBefore && resendDate(last.created_at) < options.stopBefore) break;
    after = last.id;
  }
  return { pages, seen };
}

let lastRecentSync = 0;
/** Keeps the newest few days current; runs at most every 2 minutes per server instance. */
export async function syncRecentFromResend(): Promise<void> {
  if (Date.now() - lastRecentSync < 2 * 60_000) return;
  lastRecentSync = Date.now();
  try {
    await syncFromResend({ stopBefore: new Date(Date.now() - 3 * 24 * 60 * 60_000), maxPages: 5 });
  } catch (err) {
    lastRecentSync = 0;
    console.error("[Email Log] Recent sync failed:", err);
  }
}

export async function listEmailLog(filters: {
  category?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ emails: EmailLogEntry[]; total: number; counts: Record<string, number> }> {
  await ensureTable();
  const where: SQL[] = []; // everything except the type filter
  if (filters.status === "problem") {
    where.push(dsql`${emailLog.lastEvent} IN ('bounced', 'complained', 'failed', 'delivery_delayed', 'suppressed')`);
  } else if (filters.status) {
    where.push(eq(emailLog.lastEvent, filters.status));
  }
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(emailLog.toEmail, like), ilike(emailLog.subject, like), ilike(emailLog.orderId, like))!);
  }
  const condition = and(...where, ...(filters.category ? [eq(emailLog.category, filters.category)] : []));

  const emails = await db
    .select()
    .from(emailLog)
    .where(condition)
    .orderBy(desc(emailLog.sentAt))
    .limit(Math.min(filters.limit ?? 50, 200))
    .offset(filters.offset ?? 0);
  const [{ total }] = await db.select({ total: dsql<number>`count(*)::int` }).from(emailLog).where(condition);

  // Counts per type ignore the type filter, so the chips show what each would give.
  const countRows = await db
    .select({ category: emailLog.category, n: dsql<number>`count(*)::int` })
    .from(emailLog)
    .where(and(...where))
    .groupBy(emailLog.category);
  const counts = Object.fromEntries(countRows.map((r) => [r.category, Number(r.n)]));

  return { emails, total: Number(total), counts };
}
