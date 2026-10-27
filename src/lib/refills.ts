// Bottle refills: a customer fills out /refills (free), sends or drops off their empty
// bottle, and once it arrives in one piece we email a payment link for $20 plus the real
// return shipping (or $20 for local pickup). Paying first isn't asked, so a bottle that
// breaks on the way to us never needs a refund.

import crypto from "crypto";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";

export const REFILL_PRICE_CENTS = 2000;
const SHOP_EMAIL = "contact@desertcandleworks.com";
/** A refilled liquor bottle plus packaging, for return shipping quotes. */
const REFILL_WEIGHT_OZ = 40 + 16;
const PACKING_COST_CENTS = 200;

// Same as drizzle/0022_refill_requests.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "refill_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "number" serial,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "phone" text NOT NULL,
    "bottle" text NOT NULL,
    "scent" text NOT NULL,
    "send_method" varchar(20) NOT NULL,
    "return_method" varchar(20) NOT NULL,
    "address" jsonb,
    "notes" text,
    "status" varchar(30) NOT NULL DEFAULT 'requested',
    "shipping_cents" integer,
    "shipping_service" text,
    "paid_cents" integer,
    "stripe_session_id" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
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

export type RefillAddress = { line1: string; line2?: string; city: string; state: string; postalCode: string };

export type RefillStatus =
  | "requested" // form sent, waiting for the bottle
  | "awaiting_payment" // bottle arrived intact, payment link sent
  | "paid" // paid, ready to pour
  | "done" // returned (shipped or picked up)
  | "broken" // arrived broken
  | "cancelled";

export type RefillRequest = {
  id: string;
  number: number;
  name: string;
  email: string;
  phone: string;
  bottle: string;
  scent: string;
  sendMethod: "mail" | "dropoff";
  returnMethod: "ship" | "pickup";
  address: RefillAddress | null;
  notes: string | null;
  status: RefillStatus;
  shippingCents: number | null;
  shippingService: string | null;
  paidCents: number | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown>;
const fromRow = (r: Row): RefillRequest => ({
  id: String(r.id),
  number: Number(r.number),
  name: String(r.name),
  email: String(r.email),
  phone: String(r.phone),
  bottle: String(r.bottle),
  scent: String(r.scent),
  sendMethod: r.send_method as RefillRequest["sendMethod"],
  returnMethod: r.return_method as RefillRequest["returnMethod"],
  address: (r.address as RefillAddress) ?? null,
  notes: (r.notes as string) ?? null,
  status: r.status as RefillStatus,
  shippingCents: r.shipping_cents == null ? null : Number(r.shipping_cents),
  shippingService: (r.shipping_service as string) ?? null,
  paidCents: r.paid_cents == null ? null : Number(r.paid_cents),
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export const refillLabel = (r: Pick<RefillRequest, "number">) => `R-${1000 + r.number}`;
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const baseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;

/** Signed link to pay for a refill, so only the customer's email can open it. */
export function refillPayToken(id: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.RESEND_API_KEY || "";
  return crypto.createHmac("sha256", secret).update(`refill:${id}`).digest("base64url").slice(0, 32);
}
export function verifyRefillPayToken(id: string, token: string): boolean {
  const expected = Buffer.from(refillPayToken(id));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
export const refillPayUrl = (id: string) => `${baseUrl()}/refills/pay/${id}?t=${refillPayToken(id)}`;

/** Where mail-in bottles go (the shop's ship-from address). */
export function shopMailingAddress(): string[] | null {
  const street = process.env.SHIPPO_FROM_ADDRESS || process.env.SHIPSTATION_FROM_ADDRESS;
  if (!street) return null;
  const city = process.env.SHIPPO_FROM_CITY || process.env.SHIPSTATION_FROM_CITY || "Scottsdale";
  const state = process.env.SHIPPO_FROM_STATE || process.env.SHIPSTATION_FROM_STATE || "AZ";
  const zip = process.env.SHIPPO_FROM_POSTAL_CODE || process.env.SHIPSTATION_FROM_POSTAL_CODE || "";
  return ["Desert Candle Works", street, `${city}, ${state} ${zip}`.trim()];
}

export async function createRefillRequest(input: Omit<RefillRequest, "id" | "number" | "status" | "shippingCents" | "shippingService" | "paidCents" | "createdAt" | "updatedAt">): Promise<RefillRequest> {
  await ensureTable();
  const result = await db.execute(dsql`
    INSERT INTO refill_requests (name, email, phone, bottle, scent, send_method, return_method, address, notes)
    VALUES (${input.name}, ${input.email}, ${input.phone}, ${input.bottle}, ${input.scent}, ${input.sendMethod},
            ${input.returnMethod}, ${input.address ? JSON.stringify(input.address) : null}::jsonb, ${input.notes})
    RETURNING *
  `);
  const request = fromRow(result.rows[0] as Row);
  await Promise.all([sendRequestConfirmation(request), notifyShop(request, "New refill request")]).catch((err) =>
    console.error("[Refill] Emails failed:", err)
  );
  return request;
}

export async function getRefillRequest(id: string): Promise<RefillRequest | null> {
  await ensureTable();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await db.execute(dsql`SELECT * FROM refill_requests WHERE id = ${id}`);
  return result.rows[0] ? fromRow(result.rows[0] as Row) : null;
}

export async function listRefillRequests(): Promise<RefillRequest[]> {
  await ensureTable();
  const result = await db.execute(dsql`SELECT * FROM refill_requests ORDER BY created_at DESC`);
  return (result.rows as Row[]).map(fromRow);
}

async function setStatus(id: string, status: RefillStatus, extra: { shippingCents?: number | null; shippingService?: string | null; paidCents?: number; stripeSessionId?: string } = {}) {
  await db.execute(dsql`
    UPDATE refill_requests SET status = ${status}, updated_at = now(),
      shipping_cents = coalesce(${extra.shippingCents ?? null}, shipping_cents),
      shipping_service = coalesce(${extra.shippingService ?? null}, shipping_service),
      paid_cents = coalesce(${extra.paidCents ?? null}, paid_cents),
      stripe_session_id = coalesce(${extra.stripeSessionId ?? null}, stripe_session_id)
    WHERE id = ${id}
  `);
}

/** Cheapest real return shipping to their address, plus packing. */
async function quoteReturnShipping(address: RefillAddress): Promise<{ cents: number; service: string }> {
  const { getShippingRates } = await import("@/lib/shippo");
  const from = process.env.SHIPPO_FROM_POSTAL_CODE || process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260";
  const rates = await getShippingRates(from, address.postalCode, REFILL_WEIGHT_OZ, true, address.city, address.state, address.line1, address.line2);
  const cheapest = [...rates].sort((a, b) => a.shipmentCost - b.shipmentCost)[0];
  if (!cheapest) throw new Error("No shipping rates came back for that address");
  return { cents: Math.round(cheapest.shipmentCost * 100) + PACKING_COST_CENTS, service: cheapest.serviceName };
}

/** The bottle arrived in one piece: price the return and email a payment link. */
export async function markRefillReceived(id: string): Promise<RefillRequest> {
  const request = await getRefillRequest(id);
  if (!request) throw new Error("Refill request not found");
  if (request.status !== "requested") throw new Error("This refill isn't waiting for its bottle");
  const quote = request.returnMethod === "ship" && request.address ? await quoteReturnShipping(request.address) : null;
  await setStatus(id, "awaiting_payment", { shippingCents: quote?.cents ?? 0, shippingService: quote?.service ?? null });
  const updated = (await getRefillRequest(id))!;
  await sendPaymentEmail(updated);
  return updated;
}

/** The bottle arrived broken: let them know. Nothing was paid, so nothing to refund. */
export async function markRefillBroken(id: string, note?: string): Promise<void> {
  const request = await getRefillRequest(id);
  if (!request) throw new Error("Refill request not found");
  await setStatus(id, "broken");
  const subject = `About your refill ${refillLabel(request)}`;
  const message = [
    `Hi ${request.name.split(/\s+/)[0]},`,
    "",
    `We're so sorry: your ${request.bottle} bottle arrived broken, so we can't refill it. You haven't been charged anything.`,
    ...(note?.trim() ? ["", note.trim()] : []),
    "",
    "If you have another bottle, we'd be happy to try again. Just reply to this email.",
    "",
    "Josh & Cori",
  ].join("\n");
  const { html, text } = renderMessageEmail({ subject, message, personal: false, baseUrl: baseUrl() });
  await sendEmailWithId({ to: request.email, subject, html, text, replyTo: SHOP_EMAIL, category: "notification" });
}

export async function markRefillDone(id: string): Promise<void> {
  await setStatus(id, "done");
}

export async function cancelRefill(id: string): Promise<void> {
  await setStatus(id, "cancelled");
}

/** Paid through the payment link (Stripe webhook). */
export async function markRefillPaid(id: string, paidCents: number, stripeSessionId: string): Promise<void> {
  const request = await getRefillRequest(id);
  if (!request || request.status === "paid") return;
  await setStatus(id, "paid", { paidCents, stripeSessionId });
  await notifyShop({ ...request, status: "paid", paidCents }, `Refill ${refillLabel(request)} paid (${money(paidCents)})`);
}

/** Total to charge: the refill plus return shipping. */
export const refillTotalCents = (r: Pick<RefillRequest, "shippingCents">) => REFILL_PRICE_CENTS + (r.shippingCents ?? 0);

async function sendRequestConfirmation(r: RefillRequest): Promise<void> {
  const label = refillLabel(r);
  const address = shopMailingAddress();
  const subject = `Your refill request ${label}`;
  const howToSend =
    r.sendMethod === "mail"
      ? [
          "Here's how to send your bottle:",
          "",
          "1. Clean out any wax or residue if you can, and remove the old wick.",
          "2. Wrap the bottle well in bubble wrap and pack it snugly in a sturdy box so it can't move.",
          `3. Put a note inside with your name and ${label}.`,
          `4. Ship it to:`,
          ...(address ?? ["(we'll reply with our address)"]).map((line) => `   ${line}`),
          "",
          "You cover the cost of sending it to us. Once it arrives in one piece, we'll email you a link to pay " +
            (r.returnMethod === "ship"
              ? `${money(REFILL_PRICE_CENTS)} plus return shipping to your address.`
              : `${money(REFILL_PRICE_CENTS)}, and you can pick it up in Scottsdale.`),
          "If it arrives broken, you won't be charged anything.",
        ]
      : [
          "We'll reply to set up a time to drop off your bottle in Scottsdale. Once we have it, we'll email you a link to pay " +
            (r.returnMethod === "ship" ? `${money(REFILL_PRICE_CENTS)} plus return shipping.` : `${money(REFILL_PRICE_CENTS)}.`),
        ];
  const message = [
    `Hi ${r.name.split(/\s+/)[0]},`,
    "",
    `Thanks for sending a bottle back our way! We got your refill request (${label}): your ${r.bottle}, refilled with ${r.scent}.`,
    "",
    ...howToSend,
    "",
    "Questions? Just reply to this email.",
  ].join("\n");
  const { html, text } = renderMessageEmail({ subject, message, personal: false, baseUrl: baseUrl() });
  await sendEmailWithId({ to: r.email, subject, html, text, replyTo: SHOP_EMAIL, category: "notification" });
}

async function sendPaymentEmail(r: RefillRequest): Promise<void> {
  const label = refillLabel(r);
  const subject = `Your bottle arrived! Pay for refill ${label}`;
  const message = [
    `Hi ${r.name.split(/\s+/)[0]},`,
    "",
    `Your ${r.bottle} made it here safe and sound. Here's your total:`,
    "",
    `Refill (${r.scent}): ${money(REFILL_PRICE_CENTS)}`,
    r.returnMethod === "ship"
      ? `Return shipping${r.shippingService ? ` (${r.shippingService})` : ""}: ${money(r.shippingCents ?? 0)}`
      : "Local pickup in Scottsdale: free",
    `Total: ${money(refillTotalCents(r))} plus tax`,
    "",
    "Once you've paid we'll pour your candle. It takes a few days to cure, and we'll let you know when it's on its way" +
      (r.returnMethod === "pickup" ? " (or ready to pick up)." : "."),
  ].join("\n");
  const { html, text } = renderMessageEmail({
    subject,
    message,
    personal: false,
    baseUrl: baseUrl(),
    button: { label: `Pay ${money(refillTotalCents(r))}`, url: refillPayUrl(r.id) },
  });
  await sendEmailWithId({ to: r.email, subject, html, text, replyTo: SHOP_EMAIL, category: "notification" });
}

async function notifyShop(r: RefillRequest, subject: string): Promise<void> {
  const message = [
    `${subject}: ${refillLabel(r)}`,
    "",
    `Name: ${r.name}`,
    `Email: ${r.email}`,
    `Phone: ${r.phone}`,
    `Bottle: ${r.bottle}`,
    `Scent: ${r.scent}`,
    `Sending: ${r.sendMethod === "mail" ? "by mail" : "drop-off in Scottsdale"}`,
    `Return: ${r.returnMethod === "ship" && r.address ? `ship to ${[r.address.line1, r.address.line2, `${r.address.city}, ${r.address.state} ${r.address.postalCode}`].filter(Boolean).join(", ")}` : "local pickup"}`,
    ...(r.notes ? [`Notes: ${r.notes}`] : []),
    ...(r.paidCents ? [`Paid: ${money(r.paidCents)}`] : []),
  ].join("\n");
  const { html, text } = renderMessageEmail({
    subject,
    message,
    personal: false,
    baseUrl: baseUrl(),
    button: { label: "Open in admin", url: `${baseUrl()}/admin/refills` },
  });
  await sendEmailWithId({ to: SHOP_EMAIL, subject, html, text, replyTo: r.email, category: "notification" });
}
