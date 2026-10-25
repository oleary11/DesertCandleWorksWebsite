// Conversations started from /admin/emails. A single-recipient email opens a thread;
// its Reply-To is reply+{threadId}@EMAIL_REPLY_DOMAIN, so the customer's answer comes
// back through the Resend inbound webhook (/api/email/inbound) and lands here.

import { and, asc, desc, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailMessages, emailThreads } from "@/lib/db/schema";

export type EmailThread = typeof emailThreads.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;

// Same as drizzle/0013_email_threads.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "email_threads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "customer_email" varchar(255) NOT NULL,
    "customer_name" varchar(255),
    "subject" text NOT NULL,
    "personal" boolean NOT NULL DEFAULT false,
    "unread_count" integer NOT NULL DEFAULT 0,
    "last_message_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "email_threads_last_message_idx" ON "email_threads" ("last_message_at")`,
  `CREATE INDEX IF NOT EXISTS "email_threads_customer_idx" ON "email_threads" (lower("customer_email"))`,
  `CREATE TABLE IF NOT EXISTS "email_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "thread_id" uuid NOT NULL REFERENCES "email_threads"("id") ON DELETE CASCADE,
    "direction" varchar(3) NOT NULL,
    "from_email" varchar(255) NOT NULL,
    "subject" text NOT NULL DEFAULT '',
    "body_text" text NOT NULL DEFAULT '',
    "message_id" text,
    "resend_id" varchar(100) UNIQUE,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "email_messages_thread_idx" ON "email_messages" ("thread_id", "created_at")`,
];

let ensured: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  ensured ??= (async () => {
    for (const statement of ENSURE_STATEMENTS) await db.execute(dsql.raw(statement));
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

/** Where replies are routed. Unset means replies can't be captured (emails still send). */
export function replyDomain(): string | null {
  return process.env.EMAIL_REPLY_DOMAIN?.trim().toLowerCase() || null;
}

export function replyAddressFor(threadId: string): string | null {
  const domain = replyDomain();
  return domain ? `reply+${threadId}@${domain}` : null;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pulls the thread id out of reply+{id}@domain in any of the given addresses. */
export function threadIdFromAddresses(addresses: string[]): string | null {
  for (const address of addresses) {
    const match = address.match(new RegExp(`reply\\+(${UUID.source})@`, "i"));
    if (match) return match[1].toLowerCase();
  }
  return null;
}

export async function createThread(input: {
  customerEmail: string;
  customerName?: string | null;
  subject: string;
  personal: boolean;
}): Promise<EmailThread> {
  await ensureTables();
  const [thread] = await db
    .insert(emailThreads)
    .values({
      customerEmail: input.customerEmail,
      customerName: input.customerName || null,
      subject: input.subject,
      personal: input.personal,
    })
    .returning();
  return thread;
}

export async function deleteThread(id: string): Promise<void> {
  await ensureTables();
  await db.delete(emailThreads).where(eq(emailThreads.id, id));
}

export async function addMessage(input: {
  threadId: string;
  direction: "out" | "in";
  fromEmail: string;
  subject: string;
  bodyText: string;
  messageId?: string | null;
  resendId?: string | null;
}): Promise<EmailMessage | null> {
  await ensureTables();
  const [message] = await db
    .insert(emailMessages)
    .values({
      threadId: input.threadId,
      direction: input.direction,
      fromEmail: input.fromEmail,
      subject: input.subject,
      bodyText: input.bodyText,
      messageId: input.messageId || null,
      resendId: input.resendId || null,
    })
    .onConflictDoNothing({ target: emailMessages.resendId })
    .returning();
  if (!message) return null; // duplicate webhook delivery

  await db
    .update(emailThreads)
    .set({
      lastMessageAt: dsql`now()`,
      ...(input.direction === "in" ? { unreadCount: dsql`${emailThreads.unreadCount} + 1` } : {}),
    })
    .where(eq(emailThreads.id, input.threadId));
  return message;
}

export async function getThread(id: string): Promise<EmailThread | null> {
  if (!UUID.test(id)) return null;
  await ensureTables();
  const [thread] = await db.select().from(emailThreads).where(eq(emailThreads.id, id));
  return thread ?? null;
}

/** Most recent thread with this customer, for replies that lost the reply+ address. */
export async function latestThreadForCustomer(email: string): Promise<EmailThread | null> {
  await ensureTables();
  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(dsql`lower(${emailThreads.customerEmail}) = ${email.toLowerCase()}`)
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(1);
  return thread ?? null;
}

export async function listThreads(): Promise<Array<EmailThread & { messageCount: number; lastSnippet: string; lastDirection: string | null }>> {
  await ensureTables();
  const threads = await db.select().from(emailThreads).orderBy(desc(emailThreads.lastMessageAt)).limit(200);
  if (threads.length === 0) return [];

  const latest = await db.execute(dsql`
    SELECT DISTINCT ON (thread_id) thread_id, direction, body_text,
      count(*) OVER (PARTITION BY thread_id) AS message_count
    FROM email_messages
    ORDER BY thread_id, created_at DESC
  `);
  const byThread = new Map<string, { direction: string; body_text: string; message_count: string | number }>();
  for (const row of latest.rows as Array<{ thread_id: string; direction: string; body_text: string; message_count: string | number }>) {
    byThread.set(row.thread_id, row);
  }

  return threads.map((thread) => {
    const last = byThread.get(thread.id);
    return {
      ...thread,
      messageCount: Number(last?.message_count ?? 0),
      lastSnippet: (last?.body_text ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
      lastDirection: last?.direction ?? null,
    };
  });
}

export async function getThreadMessages(threadId: string): Promise<EmailMessage[]> {
  await ensureTables();
  return db.select().from(emailMessages).where(eq(emailMessages.threadId, threadId)).orderBy(asc(emailMessages.createdAt));
}

export async function markThreadRead(threadId: string): Promise<void> {
  await ensureTables();
  await db.update(emailThreads).set({ unreadCount: 0 }).where(and(eq(emailThreads.id, threadId), dsql`${emailThreads.unreadCount} > 0`));
}

/** RFC Message-ID of the customer's latest reply, so our answer threads under it. */
export async function latestInboundMessageId(threadId: string): Promise<string | null> {
  await ensureTables();
  const [row] = await db
    .select({ messageId: emailMessages.messageId })
    .from(emailMessages)
    .where(and(eq(emailMessages.threadId, threadId), eq(emailMessages.direction, "in"), dsql`${emailMessages.messageId} IS NOT NULL`))
    .orderBy(desc(emailMessages.createdAt))
    .limit(1);
  return row?.messageId ?? null;
}

export async function totalUnread(): Promise<number> {
  await ensureTables();
  const [row] = await db.select({ total: dsql<number>`coalesce(sum(${emailThreads.unreadCount}), 0)::int` }).from(emailThreads);
  return Number(row?.total ?? 0);
}
