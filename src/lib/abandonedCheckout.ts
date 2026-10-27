// "You left something in your cart" email. When a Stripe checkout expires unpaid (24
// hours after it was started), Stripe sends checkout.session.expired with a recovery
// link that reopens the same checkout; we email it once, unless they've ordered since.

import Stripe from "stripe";
import { kv } from "@vercel/kv";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";
import { listUnsubscribed, unsubscribeHeaders, unsubscribePageUrl } from "@/lib/unsubscribe";

/** At most one reminder per person in this many days, however many carts they leave. */
const REMIND_EVERY_DAYS = 3;

export async function sendAbandonedCheckoutEmail(stripe: Stripe, session: Stripe.Checkout.Session): Promise<string> {
  const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  const recoveryUrl = session.after_expiration?.recovery?.url;
  if (!email) return "no email entered";
  if (!recoveryUrl) return "no recovery link";
  if ((await listUnsubscribed()).has(email)) return "unsubscribed";

  // They may have come back and paid in a new checkout.
  const ordered = await db.execute(dsql`
    SELECT 1 FROM orders
    WHERE lower(email) = ${email} AND status <> 'cancelled' AND created_at >= to_timestamp(${session.created})
    LIMIT 1
  `);
  if (ordered.rows.length) return "ordered since";

  if (!(await kv.set(`abandoned:sent:${email}`, session.id, { nx: true, ex: REMIND_EVERY_DAYS * 86_400 })))
    return "reminded recently";

  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  const names = items.data
    .map((item) => `${item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ""}${item.description ?? "Candle"}`)
    .filter(Boolean);
  const firstName = session.customer_details?.name?.trim().split(/\s+/)[0];

  const subject = "You left something in your cart";
  const message = [
    `${firstName ? `Hi ${firstName},` : "Hi there,"}`,
    "",
    "Looks like you didn't get to finish your order. We saved it for you:",
    "",
    ...names.map((name) => `• ${name}`),
    "",
    "Every candle is hand-poured in small batches, so stock can run out. The button below picks up right where you left off.",
    "",
    "Questions about scents or shipping? Just reply to this email.",
  ].join("\n");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const unsubscribeUrl = unsubscribePageUrl(email);
  const { html, text } = renderMessageEmail({
    subject,
    message,
    personal: false,
    baseUrl,
    unsubscribeUrl,
    button: { label: "Finish your order", url: recoveryUrl },
  });
  await sendEmailWithId({
    to: email,
    subject,
    html,
    text,
    replyTo: "contact@desertcandleworks.com",
    category: "notification",
    headers: unsubscribeHeaders(email),
  });
  return "sent";
}
