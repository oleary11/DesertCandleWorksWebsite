// Gift cards: bought on /gift-cards (or issued as store credit from admin), emailed to
// the recipient, and spent in the cart alongside any promo code. A card's balance
// carries over between orders and never expires. Each use is kept in a ledger.

import { kv } from "@vercel/kv";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";

export { GIFT_CARD_AMOUNTS, GIFT_CARD_MAX, GIFT_CARD_MAX_SEND_DAYS, GIFT_CARD_MIN } from "@/lib/giftCardOptions";
/** Stripe needs something to charge, so a gift card can't take an order below this. */
const MIN_CHARGE_CENTS = 50;

// Same as drizzle/0021_gift_cards.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "gift_cards" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" varchar(20) NOT NULL UNIQUE,
    "initial_cents" integer NOT NULL,
    "balance_cents" integer NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'pending',
    "source" varchar(20) NOT NULL DEFAULT 'purchase',
    "purchaser_name" text,
    "purchaser_email" text,
    "recipient_name" text,
    "recipient_email" text NOT NULL,
    "message" text,
    "send_at" timestamp with time zone,
    "emailed_at" timestamp with time zone,
    "stripe_session_id" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "gift_card_ledger" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "gift_card_id" uuid NOT NULL,
    "amount_cents" integer NOT NULL,
    "order_id" varchar(100),
    "note" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "gift_card_ledger_card_idx" ON "gift_card_ledger" ("gift_card_id")`,
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

export type GiftCard = {
  id: string;
  code: string;
  initialCents: number;
  balanceCents: number;
  /** pending until paid; active once usable; void if cancelled from admin. */
  status: "pending" | "active" | "void";
  source: "purchase" | "admin";
  purchaserName: string | null;
  purchaserEmail: string | null;
  recipientName: string | null;
  recipientEmail: string;
  message: string | null;
  sendAt: string | null;
  emailedAt: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const fromRow = (r: Row): GiftCard => ({
  id: String(r.id),
  code: String(r.code),
  initialCents: Number(r.initial_cents),
  balanceCents: Number(r.balance_cents),
  status: r.status as GiftCard["status"],
  source: r.source as GiftCard["source"],
  purchaserName: (r.purchaser_name as string) ?? null,
  purchaserEmail: (r.purchaser_email as string) ?? null,
  recipientName: (r.recipient_name as string) ?? null,
  recipientEmail: String(r.recipient_email),
  message: (r.message as string) ?? null,
  sendAt: iso(r.send_at),
  emailedAt: iso(r.emailed_at),
  createdAt: iso(r.created_at)!,
});

/** Codes are typed from an email, so no 0/O or 1/I. */
function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => alphabet[b % alphabet.length]).join("");
  return `GIFT-${pick()}-${pick()}`;
}

export const normalizeGiftCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export async function createGiftCard(input: {
  amountCents: number;
  source: GiftCard["source"];
  recipientEmail: string;
  recipientName?: string;
  purchaserName?: string;
  purchaserEmail?: string;
  message?: string;
  sendAt?: Date | null;
}): Promise<GiftCard> {
  await ensureTables();
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await db.execute(dsql`
      INSERT INTO gift_cards (code, initial_cents, balance_cents, status, source, purchaser_name, purchaser_email,
                              recipient_name, recipient_email, message, send_at)
      VALUES (${randomCode()}, ${input.amountCents}, ${input.amountCents},
              ${input.source === "admin" ? "active" : "pending"}, ${input.source},
              ${input.purchaserName ?? null}, ${input.purchaserEmail ?? null}, ${input.recipientName ?? null},
              ${input.recipientEmail.trim().toLowerCase()}, ${input.message ?? null}, ${input.sendAt?.toISOString() ?? null})
      ON CONFLICT (code) DO NOTHING
      RETURNING *
    `);
    if (result.rows[0]) {
      const card = fromRow(result.rows[0] as Row);
      if (input.source === "admin") {
        await db.execute(dsql`INSERT INTO gift_card_ledger (gift_card_id, amount_cents, note) VALUES (${card.id}, ${card.initialCents}, 'Issued from admin')`);
      }
      return card;
    }
  }
  throw new Error("Couldn't create a unique gift card code");
}

export async function getGiftCard(id: string): Promise<GiftCard | null> {
  await ensureTables();
  const result = await db.execute(dsql`SELECT * FROM gift_cards WHERE id = ${id}`);
  return result.rows[0] ? fromRow(result.rows[0] as Row) : null;
}

/** A usable card by its code, or null. */
export async function findActiveGiftCard(code: string): Promise<GiftCard | null> {
  await ensureTables();
  const result = await db.execute(dsql`SELECT * FROM gift_cards WHERE code = ${normalizeGiftCode(code)} AND status = 'active'`);
  return result.rows[0] ? fromRow(result.rows[0] as Row) : null;
}

export async function listGiftCards(): Promise<GiftCard[]> {
  await ensureTables();
  const result = await db.execute(dsql`SELECT * FROM gift_cards WHERE status <> 'pending' ORDER BY created_at DESC`);
  return (result.rows as Row[]).map(fromRow);
}

/** How much of a card an order can use: its balance, up to the amount left to pay (Stripe needs at least 50¢). */
export function giftCardAmountFor(card: GiftCard, amountDueCents: number): number {
  return Math.max(0, Math.min(card.balanceCents, amountDueCents - MIN_CHARGE_CENTS));
}

/**
 * Takes an order's gift card amount off the balance once it's paid. Takes what's left if
 * the card was spent elsewhere in the meantime, and returns how much it actually took.
 */
export async function redeemGiftCard(id: string, cents: number, orderId: string): Promise<number> {
  await ensureTables();
  const result = await db.execute(dsql`
    WITH before AS (SELECT balance_cents FROM gift_cards WHERE id = ${id} AND status = 'active' FOR UPDATE)
    UPDATE gift_cards g SET balance_cents = g.balance_cents - least(before.balance_cents, ${cents})
    FROM before WHERE g.id = ${id}
    RETURNING least(before.balance_cents, ${cents}) AS taken
  `);
  const taken = Math.min(cents, Number((result.rows[0] as { taken?: number } | undefined)?.taken ?? 0));
  if (taken > 0) {
    await db.execute(dsql`INSERT INTO gift_card_ledger (gift_card_id, amount_cents, order_id) VALUES (${id}, ${-taken}, ${orderId})`);
  }
  if (taken < cents) console.error(`[Gift card] ${id} was short for order ${orderId}: needed ${cents}, took ${taken}`);
  return taken;
}

/** A purchased card was paid for: make it usable and email it (now, or at the chosen time). */
export async function activatePurchasedGiftCard(id: string, stripeSessionId: string): Promise<GiftCard | null> {
  await ensureTables();
  const result = await db.execute(dsql`
    UPDATE gift_cards SET status = 'active', stripe_session_id = ${stripeSessionId}
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `);
  const card = result.rows[0] ? fromRow(result.rows[0] as Row) : null;
  if (!card) return null;
  await db.execute(dsql`INSERT INTO gift_card_ledger (gift_card_id, amount_cents, note) VALUES (${id}, ${card.initialCents}, 'Purchased')`);
  await sendGiftCardEmail(card);
  if (card.purchaserEmail) await sendPurchaserReceipt(card).catch((err) => console.error("[Gift card] Receipt failed:", err));
  return card;
}

export async function voidGiftCard(id: string): Promise<void> {
  await ensureTables();
  await db.execute(dsql`UPDATE gift_cards SET status = 'void' WHERE id = ${id}`);
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Emails the card to its recipient: right away, or scheduled for its send date. */
export async function sendGiftCardEmail(card: GiftCard): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const from = card.purchaserName?.trim();
  const subject = from ? `${from} sent you a Desert Candle Works gift card` : "You've got a Desert Candle Works gift card";
  const message = [
    card.recipientName ? `Hi ${card.recipientName.trim()},` : "Hi there,",
    "",
    from
      ? `${from} sent you a ${money(card.initialCents)} gift card to Desert Candle Works.`
      : `Here's a ${money(card.initialCents)} gift card to Desert Candle Works.`,
    ...(card.message?.trim() ? ["", `"${card.message.trim()}"`, from ? `- ${from}` : ""] : []),
    "",
    "Every candle is hand-poured in Scottsdale with natural coconut apricot wax, in a liquor bottle we rescued and cut by hand. Use your code at checkout; whatever you don't spend stays on the card for next time, and it never expires.",
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
  const { html, text } = renderMessageEmail({
    subject,
    message,
    personal: false,
    baseUrl,
    code: card.code,
    button: { label: "Shop with your gift card", url: `${baseUrl}/shop?giftcard=${encodeURIComponent(card.code)}` },
  });
  const sendAt = card.sendAt && new Date(card.sendAt).getTime() > Date.now() + 60_000 ? new Date(card.sendAt) : undefined;
  await sendEmailWithId({
    to: card.recipientEmail,
    subject,
    html,
    text,
    replyTo: "contact@desertcandleworks.com",
    category: "notification",
    scheduledAt: sendAt,
  });
  await db.execute(dsql`UPDATE gift_cards SET emailed_at = ${(sendAt ?? new Date()).toISOString()} WHERE id = ${card.id}`);
}

async function sendPurchaserReceipt(card: GiftCard): Promise<void> {
  const when = card.sendAt && new Date(card.sendAt).getTime() > Date.now() + 60_000
    ? `It will be emailed to ${card.recipientEmail} on ${new Date(card.sendAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Phoenix" })}.`
    : `We just emailed it to ${card.recipientEmail}.`;
  const subject = `Your ${money(card.initialCents)} gift card is on its way`;
  const message = [
    "Thank you for giving Desert Candle Works!",
    "",
    `Your ${money(card.initialCents)} gift card${card.recipientName ? ` for ${card.recipientName}` : ""} is ready. ${when}`,
    "",
    `The code is below too, in case you'd rather hand it over yourself.`,
  ].join("\n");
  const { html, text } = renderMessageEmail({ subject, message, personal: false, code: card.code });
  await sendEmailWithId({
    to: card.purchaserEmail!,
    subject,
    html,
    text,
    replyTo: "contact@desertcandleworks.com",
    category: "order",
  });
}

/** Limits code lookups per visitor, so codes can't be guessed. */
export async function giftCardLookupAllowed(ip: string): Promise<boolean> {
  try {
    const key = `rate_limit:giftcard:${ip}`;
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, 3600);
    return n <= 15;
  } catch {
    return true;
  }
}
