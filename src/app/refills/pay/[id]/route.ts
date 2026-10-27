import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  REFILL_PRICE_CENTS,
  getRefillRequest,
  refillLabel,
  verifyRefillPayToken,
} from "@/lib/refills";

export const runtime = "nodejs";

/**
 * The "Pay" button in the bottle-arrived email. Opens a fresh Stripe checkout each time,
 * so the link keeps working however long the email sits.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const request = verifyRefillPayToken(id, token) ? await getRefillRequest(id) : null;
  if (!request) return NextResponse.redirect(`${origin}/refills?pay=invalid`);
  if (request.status === "paid" || request.status === "done") return NextResponse.redirect(`${origin}/refills?paid=1`);
  if (request.status !== "awaiting_payment") return NextResponse.redirect(`${origin}/refills?pay=invalid`);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: REFILL_PRICE_CENTS,
          product_data: { name: `Bottle refill ${refillLabel(request)}`, description: `${request.bottle}, refilled with ${request.scent}` },
        },
      },
    ],
    ...(request.shippingCents
      ? {
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount" as const,
                fixed_amount: { amount: request.shippingCents, currency: "usd" },
                display_name: `Return shipping${request.shippingService ? ` (${request.shippingService})` : ""}`,
              },
            },
          ],
        }
      : {}),
    customer_email: request.email,
    billing_address_collection: "required",
    automatic_tax: { enabled: true },
    metadata: { type: "refill", refillId: request.id },
    success_url: `${origin}/refills?paid=1`,
    cancel_url: `${origin}/refills`,
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
