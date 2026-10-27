// Log of every Desert Candle Works email sent through Resend, for the "Sent" tab in
// /admin/emails. The Resend account is shared with other projects, so we keep our own
// list: each send is recorded by lib/email.ts, and syncFromResend() fills in anything
// sent elsewhere (e.g. Gmail through Resend SMTP) and refreshes delivery status.

import { and, desc, eq, getTableColumns, ilike, inArray, isNull, or, sql as dsql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailLog } from "@/lib/db/schema";

export type EmailLogEntry = typeof emailLog.$inferSelect;

// List rows leave out the (large) email bodies.
const SUMMARY_COLUMNS = Object.fromEntries(
  Object.entries(getTableColumns(emailLog)).filter(([key]) => key !== "htmlBody" && key !== "textBody")
) as Omit<ReturnType<typeof getTableColumns<typeof emailLog>>, "htmlBody" | "textBody">;
export type EmailLogSummary = Omit<EmailLogEntry, "htmlBody" | "textBody">;

export type EmailCategory =
  | "order"
  | "shipping"
  | "delivered"
  | "refund"
  | "account"
  | "message"
  | "personal"
  | "notification"
  | "review"
  | "other";

// Same as drizzle/0014 + 0015, so the feature works before those migrations are run.
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
  `ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "reply_to" text`,
  `ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "html_body" text`,
  `ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "text_body" text`,
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
  else if (/^how are you liking your/i.test(subject)) category = "review";
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
  replyTo?: string;
  html: string;
  text?: string;
  /** Scheduled for later: listed at that time, as "scheduled" until Resend sends it. */
  scheduledAt?: Date;
}): Promise<void> {
  try {
    await ensureTable();
    const guessed = classifyEmail(input.subject, input.from, input.replyTo ? [input.replyTo] : []);
    const category = input.category ?? guessed.category;
    const orderId = input.orderId ?? guessed.orderId;
    const content = { replyTo: input.replyTo ?? null, htmlBody: input.html, textBody: input.text ?? null };
    await db
      .insert(emailLog)
      .values({
        resendId: input.resendId,
        toEmail: input.to,
        fromEmail: input.from,
        subject: input.subject,
        category,
        orderId,
        lastEvent: input.scheduledAt ? "scheduled" : "sent",
        ...(input.scheduledAt ? { sentAt: input.scheduledAt } : {}),
        ...content,
      })
      .onConflictDoUpdate({
        target: emailLog.resendId,
        set: { category, orderId, ...content, updatedAt: dsql`now()` },
      });
  } catch (err) {
    console.error("[Email Log] Could not record sent email:", err);
  }
}

/** Sets the status shown in the Sent tab, e.g. "canceled" for a cancelled scheduled email. */
export async function markLoggedEmails(resendIds: string[], lastEvent: string): Promise<void> {
  if (!resendIds.length) return;
  await ensureTable();
  await db
    .update(emailLog)
    .set({ lastEvent, updatedAt: dsql`now()` })
    .where(inArray(emailLog.resendId, resendIds));
}

/** A scheduled email moved to a new time: list it at that time. */
export async function setLoggedSendTime(resendIds: string[], at: Date): Promise<void> {
  if (!resendIds.length) return;
  await ensureTable();
  await db
    .update(emailLog)
    .set({ sentAt: at, updatedAt: dsql`now()` })
    .where(inArray(emailLog.resendId, resendIds));
}

type ResendListedEmail = {
  id: string;
  to: string[] | null;
  from: string;
  subject: string;
  created_at: string;
  last_event: string | null;
  reply_to: string[] | null;
  /** Set on emails scheduled for later; they're listed at the time they go out. */
  scheduled_at?: string | null;
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

    // Our domain only, and not inbox replies to a reply+ address (those are forwarded
    // to the customer in our layout, which is logged on its own).
    const ours = page.data.filter(
      (email) => OUR_DOMAIN.test(email.from) && !(email.to?.length && email.to.every((to) => /reply\+[^@]+@/i.test(to)))
    );
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
              sentAt: resendDate(email.scheduled_at || email.created_at),
            };
          })
        )
        .onConflictDoUpdate({
          target: emailLog.resendId,
          set: { lastEvent: dsql`excluded.last_event`, sentAt: dsql`excluded.sent_at`, updatedAt: dsql`now()` },
        });
      // Emails sent outside this app (e.g. Gmail via Resend SMTP) arrive without content.
      await copyMissingContent(ours.map((email) => email.id));
    }

    const last = page.data[page.data.length - 1];
    if (!page.has_more || !last) break;
    if (options.stopBefore && resendDate(last.created_at) < options.stopBefore) break;
    after = last.id;
  }
  return { pages, seen };
}

type ResendEmail = {
  html?: string | null;
  text?: string | null;
  last_event?: string | null;
  reply_to?: string[] | null;
};

async function fetchFromResend(id: string): Promise<ResendEmail | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  return res.ok ? ((await res.json()) as ResendEmail) : null;
}

/** Saves our own copy of the content for any of these emails we don't have yet. */
async function copyMissingContent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const missing = await db
    .select({ resendId: emailLog.resendId })
    .from(emailLog)
    .where(and(inArray(emailLog.resendId, ids), isNull(emailLog.htmlBody), isNull(emailLog.textBody)));
  for (const [i, { resendId }] of missing.entries()) {
    if (i > 0) await sleep(300);
    const email = await fetchFromResend(resendId);
    if (!email || (!email.html && !email.text)) continue;
    await db
      .update(emailLog)
      .set({
        htmlBody: email.html ?? null,
        textBody: email.text ?? null,
        replyTo: email.reply_to?.length ? email.reply_to.join(", ") : null,
      })
      .where(eq(emailLog.resendId, resendId));
  }
}

/**
 * One logged email with its content, from our own copy. Falls back to Resend (and
 * saves the result) only for emails we never stored; refreshes the status while
 * Resend still has the email.
 */
export async function getLoggedEmail(id: string): Promise<EmailLogEntry | null> {
  await ensureTable();
  const [logged] = await db.select().from(emailLog).where(eq(emailLog.resendId, id));
  if (!logged) return null;

  const needsContent = !logged.htmlBody && !logged.textBody;
  const recent = Date.now() - logged.sentAt.getTime() < 30 * 24 * 60 * 60_000;
  if (!needsContent && !recent) return logged;

  const remote = await fetchFromResend(id).catch(() => null);
  if (!remote) return logged;
  const update = {
    lastEvent: remote.last_event ?? logged.lastEvent,
    ...(needsContent
      ? {
          htmlBody: remote.html ?? null,
          textBody: remote.text ?? null,
          replyTo: remote.reply_to?.length ? remote.reply_to.join(", ") : logged.replyTo,
        }
      : {}),
  };
  await db.update(emailLog).set(update).where(eq(emailLog.resendId, id));
  return { ...logged, ...update };
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
}): Promise<{ emails: EmailLogSummary[]; total: number; counts: Record<string, number> }> {
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
    .select(SUMMARY_COLUMNS)
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
