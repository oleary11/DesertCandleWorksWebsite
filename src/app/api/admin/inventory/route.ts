import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPriceToSlug } from "@/lib/pricemap";
import { getResolvedProduct } from "@/lib/liveProducts";

export const runtime = "nodejs";

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;
function isLineItemArray(v: unknown): v is LineItem[] { return Array.isArray(v); }

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const stripe = new Stripe(key);

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

    // Build a merged map so new products are recognized
    const priceToSlug = await getPriceToSlug();

    // Ensure every item is in stock right now
    for (const li of lineItems) {
      const price = li.price as string | undefined;
      const slug = price ? priceToSlug.get(price) : undefined;
      if (!slug) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

      const product = await getResolvedProduct(slug);
      const stock = product?.stock ?? 0; // treat missing as 0
      const qty = li.quantity ?? 1;

      if (stock < qty) {
        return NextResponse.json(
          { error: `Out of stock: ${slug} (requested ${qty}, available ${stock})` },
          { status: 409 }
        );
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

    const isFormPost = !ct.includes("application/json") && !accept.includes("application/json");
    if (isFormPost) return NextResponse.redirect(session.url!, { status: 303 });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Checkout error" }, { status: 500 });
  }
}