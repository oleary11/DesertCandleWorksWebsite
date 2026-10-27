// "We miss you" email: customers whose last order was about 90 days ago get one email
// with their own single-use 15% off code (WINBACK-XXXXXX, good for 30 days). Runs daily
// from /api/cron/win-back. One email per customer per quiet stretch; a new order resets it.

import { kv } from "@vercel/kv";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";
import { emailLink } from "@/lib/emailFrames";
import { listOptedOut } from "@/lib/contacts";
import type { Promotion } from "@/lib/promotions";
import { createPromotion, getPromotionByCode } from "@/lib/promotionsStore";
import { unsubscribeHeaders, unsubscribePageUrl } from "@/lib/unsubscribe";

export const WIN_BACK_PERCENT = 15;
const QUIET_DAYS = 90;
/** Only customers who went quiet in the last month are picked up, so old customers aren't all emailed at once on day one. */
const LOOKBACK_DAYS = 30;
const CODE_VALID_DAYS = 30;
const MAX_PER_RUN = 40;

type Candidate = { email: string; name: string | null; lastOrderAt: string };

export async function findWinBackCandidates(): Promise<Candidate[]> {
  const result = await db.execute(dsql`
    SELECT lower(email) AS email,
           max(created_at) AS last_order_at,
           (array_agg(shipping_name ORDER BY created_at DESC) FILTER (WHERE shipping_name IS NOT NULL))[1] AS name
    FROM orders
    WHERE status <> 'cancelled' AND email LIKE '%@%'
    GROUP BY lower(email)
    HAVING max(created_at) < now() - make_interval(days => ${QUIET_DAYS})
       AND max(created_at) >= now() - make_interval(days => ${QUIET_DAYS + LOOKBACK_DAYS})
    ORDER BY max(created_at)
  `);
  const optedOut = await listOptedOut();
  return (result.rows as Array<{ email: string; last_order_at: string; name: string | null }>)
    .filter((r) => !optedOut.has(r.email))
    .map((r) => ({ email: r.email, name: r.name, lastOrderAt: new Date(r.last_order_at).toISOString() }));
}

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `WINBACK-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("")}`;
}

async function issueCode(email: string): Promise<Promotion> {
  let code = randomCode();
  while (await getPromotionByCode(code)) code = randomCode();
  const now = new Date();
  const promotion: Promotion = {
    id: `promo_${now.getTime()}_${code.slice(-6).toLowerCase()}`,
    code,
    name: `Win-back code: ${email}`,
    trigger: "code_required",
    type: "percentage",
    discountPercent: WIN_BACK_PERCENT,
    maxRedemptions: 1,
    userTargeting: "all",
    expiresAt: new Date(now.getTime() + CODE_VALID_DAYS * 86_400_000).toISOString(),
    active: true,
    currentRedemptions: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await createPromotion(promotion);
  return promotion;
}

async function sendWinBackEmail(c: Candidate, promotion: Promotion): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const firstName = c.name?.trim().split(/\s+/)[0];
  const ends = new Date(promotion.expiresAt!).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Phoenix" });
  const subject = `We saved you ${WIN_BACK_PERCENT}% off`;
  const message = [
    firstName ? `Hi ${firstName},` : "Hi there,",
    "",
    "It's been a little while! We've been busy pouring new scents and rescuing more bottles, and wanted to say thanks for being a customer with something just for you.",
    "",
    `Here's ${WIN_BACK_PERCENT}% off your next order, good through ${ends}. The button opens the shop with it already applied.`,
    "",
    "Josh & Cori",
  ].join("\n");
  const { html, text } = renderMessageEmail({
    subject,
    message,
    personal: false,
    baseUrl,
    unsubscribeUrl: unsubscribePageUrl(c.email),
    code: promotion.code,
    button: { label: `Shop with ${WIN_BACK_PERCENT}% off`, url: emailLink(baseUrl, "/shop", "win-back", promotion.code) },
  });
  await sendEmailWithId({
    to: c.email,
    subject,
    html,
    text,
    replyTo: "contact@desertcandleworks.com",
    category: "message",
    headers: unsubscribeHeaders(c.email),
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runWinBack({ dryRun = false } = {}): Promise<{ due: number; sent: number; failed: number; skipped: number }> {
  const candidates = await findWinBackCandidates();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const c of candidates) {
    if (sent >= MAX_PER_RUN) break;
    // Keyed on their last order, so a customer who orders again can get one next time they go quiet.
    const key = `winback:sent:${c.email}:${c.lastOrderAt.slice(0, 10)}`;
    if (await kv.get(key)) {
      skipped++;
      continue;
    }
    if (dryRun) {
      sent++;
      continue;
    }
    try {
      await kv.set(key, "1", { ex: 365 * 86_400 });
      await sendWinBackEmail(c, await issueCode(c.email));
      sent++;
      await sleep(600); // stay under Resend's rate limit
    } catch (err) {
      failed++;
      await kv.del(key).catch(() => {});
      console.error(`[Win-back] Failed for ${c.email}:`, err);
    }
  }
  return { due: candidates.length, sent, failed, skipped };
}
