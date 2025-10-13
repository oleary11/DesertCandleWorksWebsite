import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPriceToSlug } from "@/lib/pricemap";
import { incrStock } from "@/lib/productsStore"; // decrement via negative value

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!whSecret || !secretKey) return NextResponse.json({}, { status: 500 });

  const stripe = new Stripe(secretKey);
  const sig = req.headers.get("stripe-signature") as string;

  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Build merged price -> slug map (includes new products)
    const priceToSlug = await getPriceToSlug();

    // Fetch full line items to know quantities
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    for (const item of lineItems.data) {
      const priceId = item.price?.id || "";
      const slug = priceToSlug.get(priceId);
      const qty = item.quantity ?? 1;
      if (slug && qty > 0) {
        try {
          await incrStock(slug, -qty); // decrement
        } catch (err) {
          console.error(`Stock decrement failed for ${slug} x${qty}`, err);
        }
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}