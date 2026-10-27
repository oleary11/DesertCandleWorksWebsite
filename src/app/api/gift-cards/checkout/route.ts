import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateEmail } from "@/lib/validation";
import { GIFT_CARD_MAX, GIFT_CARD_MAX_SEND_DAYS, GIFT_CARD_MIN, createGiftCard } from "@/lib/giftCards";

export const runtime = "nodejs";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * POST: start buying a gift card. Creates the card (unusable until paid) and a Stripe
 * checkout for it; the Stripe webhook activates and emails it once paid.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (!(await checkRateLimit(ip, "checkout"))) {
    return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Payments aren't set up." }, { status: 500 });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount < GIFT_CARD_MIN || amount > GIFT_CARD_MAX) {
      return NextResponse.json({ error: `Choose an amount from $${GIFT_CARD_MIN} to $${GIFT_CARD_MAX}.` }, { status: 400 });
    }
    const recipient = validateEmail(clean(body.recipientEmail, 255));
    if (!recipient.valid) return NextResponse.json({ error: "Enter the recipient's email address." }, { status: 400 });
    const purchaser = validateEmail(clean(body.purchaserEmail, 255));
    if (!purchaser.valid) return NextResponse.json({ error: "Enter your email address for the receipt." }, { status: 400 });
    const fromName = clean(body.fromName, 80);
    if (!fromName) return NextResponse.json({ error: "Add who it's from." }, { status: 400 });

    // Send date and time, Arizona time, up to 30 days out (8 AM if no time is given).
    // A time that's already passed means send it right after payment.
    let sendAt: Date | null = null;
    const sendDate = clean(body.sendDate, 10);
    const sendTime = clean(body.sendTime, 5) || "08:00";
    if (sendDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sendDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) {
        return NextResponse.json({ error: "Pick a valid send date and time." }, { status: 400 });
      }
      const at = new Date(`${sendDate}T${sendTime}:00-07:00`);
      if (at.getTime() > Date.now() + GIFT_CARD_MAX_SEND_DAYS * 86_400_000) {
        return NextResponse.json({ error: `Pick a send date within ${GIFT_CARD_MAX_SEND_DAYS} days.` }, { status: 400 });
      }
      if (at.getTime() > Date.now() + 5 * 60_000) sendAt = at;
    }

    const card = await createGiftCard({
      amountCents: amount * 100,
      source: "purchase",
      recipientEmail: recipient.normalized,
      recipientName: clean(body.recipientName, 80) || undefined,
      purchaserName: fromName,
      purchaserEmail: purchaser.normalized,
      message: clean(body.message, 500) || undefined,
      sendAt,
    });

    const origin = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount * 100,
            product_data: {
              name: `Desert Candle Works gift card: $${amount}`,
              description: `For ${clean(body.recipientName, 80) || recipient.normalized}, emailed ${
                sendAt
                  ? sendAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" }) + " (Arizona time)"
                  : "right after you pay"
              }`,
            },
          },
        },
      ],
      customer_email: purchaser.normalized,
      // Gift cards are like cash: no tax or shipping until they're spent.
      metadata: { type: "gift_card", giftCardId: card.id },
      success_url: `${origin}/gift-cards?status=success`,
      cancel_url: `${origin}/gift-cards`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Gift card] Checkout failed:", error);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
