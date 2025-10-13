import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;

function isLineItemArray(v: unknown): v is LineItem[] {
  return Array.isArray(v);
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Use a stable, valid Stripe API version
  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });

  try {
    const ct = req.headers.get("content-type") || "";
    const accept = req.headers.get("accept") || "";
    let lineItems: LineItem[] = [];

    if (ct.includes("application/json")) {
      const body: unknown = await req.json();
      if (body && typeof body === "object" && "lineItems" in body) {
        const raw = (body as { lineItems: unknown }).lineItems;
        if (isLineItemArray(raw)) lineItems = raw;
      }
    } else {
      const form = await req.formData();
      const raw = form.get("lineItems");
      if (typeof raw === "string") {
        const parsed: unknown = JSON.parse(raw);
        if (isLineItemArray(parsed)) lineItems = parsed;
      }
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/shop?status=success`,
      cancel_url: `${origin}/shop?status=cancelled`,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
    });

    // Form posts: redirect; fetch calls: return JSON
    const isFormPost = !ct.includes("application/json") && !accept.includes("application/json");
    if (isFormPost) {
      return NextResponse.redirect(session.url!, { status: 303 });
    }
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Checkout error" }, { status: 500 });
  }
}