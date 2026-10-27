// Emails from /admin/emails scheduled for later. Resend holds and sends each one at the
// chosen time (so it's exact without a frequent cron); this keeps the list of scheduled
// sends with their Resend ids so the admin can see and cancel them.

import { Resend } from "resend";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { markLoggedEmails } from "@/lib/emailLog";
import { deleteThread } from "@/lib/emailThreadsStore";

/** Resend accepts scheduled emails up to 30 days ahead. */
export const MAX_SCHEDULE_DAYS = 30;

// Same as drizzle/0020_scheduled_emails.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "scheduled_emails" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "subject" text NOT NULL,
    "recipients_label" text NOT NULL,
    "recipient_count" integer NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "resend_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "thread_id" text,
    "status" varchar(20) NOT NULL DEFAULT 'scheduled',
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "scheduled_emails_at_idx" ON "scheduled_emails" ("scheduled_at")`,
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

export type ScheduledEmail = {
  id: string;
  subject: string;
  recipientsLabel: string;
  recipientCount: number;
  scheduledAt: string;
  threadId: string | null;
  /** "scheduled" until the time passes (then "sent"), or "cancelled". */
  status: "scheduled" | "sent" | "cancelled";
};

type Row = {
  id: string;
  subject: string;
  recipients_label: string;
  recipient_count: number;
  scheduled_at: Date | string;
  thread_id: string | null;
  status: string;
};

const fromRow = (r: Row): ScheduledEmail => {
  const scheduledAt = new Date(r.scheduled_at);
  return {
    id: r.id,
    subject: r.subject,
    recipientsLabel: r.recipients_label,
    recipientCount: r.recipient_count,
    scheduledAt: scheduledAt.toISOString(),
    threadId: r.thread_id,
    status: r.status === "cancelled" ? "cancelled" : scheduledAt.getTime() <= Date.now() ? "sent" : "scheduled",
  };
};

/** Checks a requested send time; returns the error to show, or null when it's fine. */
export function scheduleTimeError(at: Date): string | null {
  if (Number.isNaN(at.getTime())) return "That send time isn't a valid date";
  if (at.getTime() < Date.now() + 60_000) return "Pick a send time at least a minute from now";
  if (at.getTime() > Date.now() + MAX_SCHEDULE_DAYS * 86_400_000)
    return `Emails can be scheduled up to ${MAX_SCHEDULE_DAYS} days ahead`;
  return null;
}

export async function recordScheduledEmail(input: {
  subject: string;
  recipientsLabel: string;
  recipientCount: number;
  scheduledAt: Date;
  resendIds: string[];
  threadId?: string | null;
}): Promise<void> {
  await ensureTable();
  await db.execute(dsql`
    INSERT INTO scheduled_emails (subject, recipients_label, recipient_count, scheduled_at, resend_ids, thread_id)
    VALUES (${input.subject}, ${input.recipientsLabel}, ${input.recipientCount}, ${input.scheduledAt.toISOString()},
            ${JSON.stringify(input.resendIds)}::jsonb, ${input.threadId ?? null})
  `);
}

/** Upcoming sends first (soonest at the top), then the last 30 days of past ones. */
export async function listScheduledEmails(): Promise<ScheduledEmail[]> {
  await ensureTable();
  const result = await db.execute(dsql`
    SELECT id, subject, recipients_label, recipient_count, scheduled_at, thread_id, status
    FROM scheduled_emails
    WHERE scheduled_at > now() - interval '30 days'
    ORDER BY (status = 'scheduled' AND scheduled_at > now()) DESC,
             CASE WHEN scheduled_at > now() THEN scheduled_at END ASC,
             scheduled_at DESC
  `);
  return (result.rows as Row[]).map(fromRow);
}

/** Cancels every email in a scheduled send that Resend hasn't sent yet. */
export async function cancelScheduledEmail(id: string): Promise<{ cancelled: number; failed: number }> {
  await ensureTable();
  const result = await db.execute(dsql`SELECT * FROM scheduled_emails WHERE id = ${id}`);
  const row = result.rows[0] as (Row & { resend_ids: string[] }) | undefined;
  if (!row) throw new Error("Scheduled email not found");
  if (row.status === "cancelled") return { cancelled: 0, failed: 0 };
  if (new Date(row.scheduled_at).getTime() <= Date.now()) throw new Error("This email has already gone out");

  const ids: string[] = Array.isArray(row.resend_ids) ? row.resend_ids : [];
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const cancelledIds: string[] = [];
  let failed = 0;
  for (const resendId of ids) {
    if (!resend) break;
    const { error } = await resend.emails.cancel(resendId);
    if (error) {
      failed++;
      console.error(`[Scheduled Email] Couldn't cancel ${resendId}:`, error);
    } else {
      cancelledIds.push(resendId);
    }
  }
  if (failed > 0) {
    // Keep only the ones still pending, so trying again doesn't re-cancel the rest.
    const remaining = ids.filter((resendId) => !cancelledIds.includes(resendId));
    await db.execute(dsql`UPDATE scheduled_emails SET resend_ids = ${JSON.stringify(remaining)}::jsonb WHERE id = ${id}`);
  } else {
    await db.execute(dsql`UPDATE scheduled_emails SET status = 'cancelled' WHERE id = ${id}`);
    // A one-to-one email started a conversation; with the email cancelled it's empty.
    if (row.thread_id) await deleteThread(row.thread_id).catch(() => {});
  }
  if (cancelledIds.length) await markLoggedEmails(cancelledIds, "canceled");
  return { cancelled: cancelledIds.length, failed };
}
