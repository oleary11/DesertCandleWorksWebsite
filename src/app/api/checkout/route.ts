import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });

  const ct = req.headers.get("content-type") || "";
  const accept = req.headers.get("accept") || "";

  let lineItems: any[] = [];
  if (ct.includes("application/json")) {
    const body = await req.json();
    lineItems = body.lineItems;
  } else {
    const form = await req.formData();
    lineItems = JSON.parse(String(form.get("lineItems")));
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

  // If the browser posted a regular form, redirect them straight to Stripe
  const isFormPost = !ct.includes("application/json") && !accept.includes("application/json");
  if (isFormPost) {
    return NextResponse.redirect(session.url!, { status: 303 });
  }

  // If called via fetch, return JSON
  return NextResponse.json({ url: session.url }, { status: 200 });
}