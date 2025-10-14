import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPriceToProduct } from "@/lib/pricemap";
import { incrStock, incrVariantStock } from "@/lib/productsStore";

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
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : "Unknown error";
    return NextResponse.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceToProduct = await getPriceToProduct();

    for (const item of lineItems.data) {
      const priceId = item.price?.id || "";
      const productInfo = priceToProduct.get(priceId);
      const qty = item.quantity ?? 1;

      if (productInfo && qty > 0) {
        try {
          if (productInfo.variantId) {
            // Decrement variant stock
            await incrVariantStock(productInfo.slug, productInfo.variantId, -qty);
          } else {
            // Decrement base stock (backward compat for non-variant products)
            await incrStock(productInfo.slug, -qty);
          }
        } catch (err) {
          console.error(`Stock decrement failed for ${productInfo.slug} ${productInfo.variantId ? `variant ${productInfo.variantId}` : ''} x${qty}`, err);
        }
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}