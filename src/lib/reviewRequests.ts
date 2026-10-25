// Automatic "would you leave us a Google review?" emails, a few days after an order is
// delivered. Run daily by /api/cron/review-requests. Every customer who got their
// order is asked the same way (Google doesn't allow asking only happy customers).

import { and, eq, gte, isNotNull, lte, sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, refunds } from "@/lib/db/schema";
import { sendReviewRequestEmail } from "@/lib/shipmentEmails";

/** Days after delivery to ask. */
export const REVIEW_DELAY_DAYS = 4;
/** Orders delivered longer ago than this are never asked (e.g. when this first goes live). */
const MAX_AGE_DAYS = 14;
/** Don't ask the same customer again within this many days (repeat buyers). */
const PER_CUSTOMER_COOLDOWN_DAYS = 120;

const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "review_requests" (
    "order_id" varchar(255) PRIMARY KEY,
    "email" varchar(255) NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'sent',
    "error" text,
    "sent_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "review_requests_email_idx" ON "review_requests" (lower("email"))`,
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

const DAY = 24 * 60 * 60 * 1000;

export type ReviewCandidate = { orderId: string; email: string; deliveredAt: Date };

/** Orders that should get a review request today. */
export async function findReviewCandidates(now = new Date()): Promise<ReviewCandidate[]> {
  await ensureTable();
  const rows = await db
    .select({ orderId: orders.id, email: orders.email, deliveredAt: orders.deliveredAt })
    .from(orders)
    .where(
      and(
        eq(orders.status, "completed"),
        isNotNull(orders.deliveredAt),
        lte(orders.deliveredAt, new Date(now.getTime() - REVIEW_DELAY_DAYS * DAY)),
        gte(orders.deliveredAt, new Date(now.getTime() - MAX_AGE_DAYS * DAY)),
        // never asked for this order
        dsql`NOT EXISTS (SELECT 1 FROM review_requests r WHERE r.order_id = ${orders.id})`,
        // no recent ask to the same customer
        dsql`NOT EXISTS (SELECT 1 FROM review_requests r WHERE lower(r.email) = lower(${orders.email})
             AND r.sent_at > ${new Date(now.getTime() - PER_CUSTOMER_COOLDOWN_DAYS * DAY)})`,
        // not refunded (refunds remove the order from the happy path)
        dsql`NOT EXISTS (SELECT 1 FROM ${refunds} f WHERE f.order_id = ${orders.id} AND f.status <> 'failed')`
      )
    );

  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const email = row.email.trim().toLowerCase();
      if (!email.includes("@") || email.endsWith("@admin.local") || seen.has(email)) return false;
      seen.add(email); // one ask per customer per run, even with several orders
      return true;
    })
    .map((row) => ({ orderId: row.orderId, email: row.email, deliveredAt: row.deliveredAt! }));
}

/** Sends today's review requests. With `dryRun`, only reports who would get one. */
export async function runReviewRequests(options: { dryRun?: boolean } = {}) {
  const candidates = await findReviewCandidates();
  if (options.dryRun) return { dryRun: true, candidates, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    // Claim the order first so a retry or an overlapping run can't email twice.
    const claimed = await db.execute(dsql`
      INSERT INTO review_requests (order_id, email, status) VALUES (${candidate.orderId}, ${candidate.email}, 'sending')
      ON CONFLICT (order_id) DO NOTHING RETURNING order_id
    `);
    if (claimed.rows.length === 0) continue;
    try {
      await sendReviewRequestEmail(candidate.orderId);
      await db.execute(dsql`UPDATE review_requests SET status = 'sent', sent_at = now() WHERE order_id = ${candidate.orderId}`);
      sent++;
    } catch (err) {
      // Left as failed (not retried) so a broken address isn't emailed every day.
      await db.execute(dsql`UPDATE review_requests SET status = 'failed', error = ${String(err)} WHERE order_id = ${candidate.orderId}`);
      console.error(`[Review Requests] ${candidate.orderId} failed:`, err);
      failed++;
    }
  }
  return { dryRun: false, candidates, sent, failed };
}
