// Unsubscribes for mass emails sent from /admin/emails. Every mass email carries a
// signed link (and Gmail's one-click List-Unsubscribe header); anyone in this table is
// skipped on future mass sends. One-to-one conversations aren't affected.

import crypto from "crypto";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { DEFAULT_BASE_URL } from "@/lib/emailLayout";

const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "email_unsubscribes" (
    "email" varchar(255) PRIMARY KEY,
    "source" varchar(30) NOT NULL DEFAULT 'link',
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
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

function secret(): string {
  const value = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.RESEND_API_KEY;
  if (!value) throw new Error("No secret available to sign unsubscribe links");
  return value;
}

function tokenFor(email: string): string {
  return crypto.createHmac("sha256", secret()).update(`unsubscribe:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(tokenFor(email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Link to the confirmation page shown in the email footer. */
export function unsubscribePageUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  return `${base}/unsubscribe?e=${encodeURIComponent(email)}&t=${tokenFor(email)}`;
}

/** Headers so Gmail/Yahoo show their own "Unsubscribe" button (RFC 8058 one-click). */
export function unsubscribeHeaders(email: string): Record<string, string> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const oneClick = `${base}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${tokenFor(email)}`;
  return {
    "List-Unsubscribe": `<${oneClick}>, <mailto:contact@desertcandleworks.com?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function addUnsubscribe(email: string, source: "link" | "one-click" | "admin" = "link"): Promise<void> {
  await ensureTable();
  await db.execute(dsql`
    INSERT INTO email_unsubscribes (email, source) VALUES (${email.trim().toLowerCase()}, ${source})
    ON CONFLICT (email) DO NOTHING
  `);
}

export async function removeUnsubscribe(email: string): Promise<void> {
  await ensureTable();
  await db.execute(dsql`DELETE FROM email_unsubscribes WHERE email = ${email.trim().toLowerCase()}`);
}

export async function listUnsubscribed(): Promise<Set<string>> {
  await ensureTable();
  const result = await db.execute(dsql`SELECT email FROM email_unsubscribes`);
  return new Set((result.rows as Array<{ email: string }>).map((row) => row.email));
}
