import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPriceToProduct } from "@/lib/pricemap";
import { incrStock, incrVariantStock } from "@/lib/productsStore";
import { getUserByEmail, createOrder, completeOrder, redeemPoints } from "@/lib/userStore";

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

    // SECURITY: Idempotency check - prevent webhook replay attacks
    // Check if this order was already processed by checking if it exists and is completed
    const { getOrderById } = await import("@/lib/userStore");
    const existingOrder = await getOrderById(session.id);
    if (existingOrder && existingOrder.status === "completed") {
      console.log(`[Webhook] Order ${session.id} already processed - skipping (replay protection)`);
      return NextResponse.json({ received: true, skipped: "already_processed" }, { status: 200 });
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceToProduct = await getPriceToProduct();

    const customerEmail = session.customer_details?.email || "";
    const pointsRedeemed = session.metadata?.pointsRedeemed ? parseInt(session.metadata.pointsRedeemed) : 0;
    const sessionUserId = session.metadata?.userId || "";
    const orderItems: Array<{
      productSlug: string;
      productName: string;
      quantity: number;
      priceCents: number;
    }> = [];

    // Calculate product subtotal (EXCLUDING shipping and tax)
    let productSubtotalCents = 0;

    // Process line items for stock and order details
    for (let index = 0; index < lineItems.data.length; index++) {
      const item = lineItems.data[index];
      const qty = item.quantity ?? 1;

      // Get price ID from session metadata (set during checkout)
      const priceId = session.metadata?.[`item_${index}_price`] || item.price?.id || "";
      const productInfo = priceToProduct.get(priceId);

      if (productInfo && qty > 0) {
        const itemTotal = item.amount_total || 0;

        // Add to order items
        orderItems.push({
          productSlug: productInfo.slug,
          productName: productInfo.name,
          quantity: qty,
          priceCents: itemTotal,
        });

        // Add to product subtotal (for points calculation)
        productSubtotalCents += itemTotal;

        // Check if there's variant info in session metadata
        const variantId = session.metadata?.[`item_${index}_variant`];

        try {
          if (variantId) {
            // Decrement variant stock
            console.log(`Decrementing variant stock: ${productInfo.slug} variant ${variantId} x${qty}`);
            await incrVariantStock(productInfo.slug, variantId, -qty);
          } else {
            // Decrement base stock (for non-variant products)
            console.log(`Decrementing base stock: ${productInfo.slug} x${qty}`);
            await incrStock(productInfo.slug, -qty);
          }
        } catch (err) {
          console.error(`Stock decrement failed for ${productInfo.slug} ${variantId ? `variant ${variantId}` : ''} x${qty}`, err);
        }
      } else {
        console.warn(`No product mapping found for price ${priceId} at line item ${index}`);
      }
    }

    // Handle order creation and points/rewards
    if (customerEmail) {
      try {
        const user = await getUserByEmail(customerEmail);

        if (user) {
          // Redeem points if they were used in checkout
          if (pointsRedeemed > 0 && sessionUserId === user.id) {
            try {
              await redeemPoints(user.id, pointsRedeemed, `Redeemed for order #${session.id.slice(0, 8)}`);
              console.log(`Redeemed ${pointsRedeemed} points for ${customerEmail}`);
            } catch (err) {
              console.error(`Failed to redeem points for ${customerEmail}:`, err);
            }
          }

          // User has an account - create order and award points
          // IMPORTANT: Use productSubtotalCents (products only, no shipping/tax) for points
          console.log(`Creating order for user ${user.id} (${customerEmail})`);
          await createOrder(customerEmail, session.id, productSubtotalCents, orderItems, user.id);
          await completeOrder(session.id);
          console.log(`Awarded ${Math.round(productSubtotalCents / 100)} points to ${customerEmail}`);
        } else {
          // Guest checkout - create order without userId
          console.log(`Guest checkout for ${customerEmail} - creating guest order`);
          await createOrder(customerEmail, session.id, productSubtotalCents, orderItems);
          await completeOrder(session.id);
          console.log(`Guest order created for ${customerEmail}`);

          // Add guest to mailing list (don't block order processing if this fails)
          try {
            const buttondownKey = process.env.BUTTONDOWN_API_KEY;
            if (buttondownKey) {
              const mailingListRes = await fetch("https://api.buttondown.email/v1/subscribers", {
                method: "POST",
                headers: {
                  Authorization: `Token ${buttondownKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email_address: customerEmail,
                  type: "regular" // Bypass confirmation email
                }),
              });

              if (mailingListRes.ok) {
                console.log(`[Webhook] Added guest ${customerEmail} to mailing list`);
              } else {
                const errorText = await mailingListRes.text();
                if (!errorText.toLowerCase().includes("already")) {
                  console.error("[Webhook] Failed to add guest to mailing list:", errorText);
                }
              }
            }
          } catch (mailingErr) {
            console.error("[Webhook] Failed to add guest to mailing list:", mailingErr);
          }
        }

        // Send invoice email to all customers (guest or not)
        try {
          const { sendOrderInvoiceEmail } = await import("@/lib/email");
          await sendOrderInvoiceEmail(session.id);
          console.log(`Invoice email sent to ${customerEmail}`);
        } catch (emailErr) {
          console.error(`Failed to send invoice email to ${customerEmail}:`, emailErr);
          // Don't throw - order is already created
        }
      } catch (err) {
        console.error(`Failed to process order for ${customerEmail}:`, err);
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}