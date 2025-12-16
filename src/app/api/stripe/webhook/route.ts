import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPriceToProduct } from "@/lib/pricemap";
import { incrStock, incrVariantStock } from "@/lib/productsStore";
import { getUserByEmail, createOrder, completeOrder, redeemPoints, isWebhookProcessed, markWebhookProcessed } from "@/lib/userStore";
import { incrementRedemptions } from "@/lib/promotionsStore";

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

    // SECURITY: Idempotency check - prevent webhook replay attacks by tracking event IDs
    // Check if this specific webhook event was already processed
    if (await isWebhookProcessed(event.id)) {
      console.log(`[Webhook] Event ${event.id} already processed - skipping (replay protection)`);
      return NextResponse.json({ received: true, skipped: "event_already_processed" }, { status: 200 });
    }

    // Additional check: verify order wasn't already processed (defense in depth)
    const { getOrderById } = await import("@/lib/userStore");
    const existingOrder = await getOrderById(session.id);
    if (existingOrder && existingOrder.status === "completed") {
      // Verify order completeness by checking item count and total
      const sessionTotal = session.amount_total || 0;
      const orderTotal = existingOrder.totalCents;

      // If totals match, order is complete and correct - skip reprocessing
      if (orderTotal === sessionTotal) {
        console.log(`[Webhook] Order ${session.id} already processed correctly - skipping (replay protection)`);
        return NextResponse.json({ received: true, skipped: "already_processed" }, { status: 200 });
      }

      // If totals don't match, order may be incomplete - log warning and reprocess
      console.warn(`[Webhook] Order ${session.id} exists but totals don't match (Stripe: ${sessionTotal}, DB: ${orderTotal}) - reprocessing to fix`);
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceToProduct = await getPriceToProduct();

    const customerEmail = session.customer_details?.email || "";
    const pointsRedeemed = session.metadata?.pointsRedeemed ? parseInt(session.metadata.pointsRedeemed) : 0;
    const sessionUserId = session.metadata?.userId || "";
    const promotionId = session.metadata?.promotionId || "";
    const orderItems: Array<{
      productSlug: string;
      productName: string;
      quantity: number;
      priceCents: number;
    }> = [];

    // Extract order totals from Stripe session
    const totalCents = session.amount_total || 0; // Full order total (products + shipping + tax)
    const shippingCents = session.total_details?.amount_shipping || 0;
    const taxCents = session.total_details?.amount_tax || 0;

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

        // Get product name from session metadata (stored during checkout)
        const productName = session.metadata?.[`item_${index}_name`] || item.description || "Unknown Product";

        // Add to order items
        orderItems.push({
          productSlug: productInfo.slug,
          productName,
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

          // Also update TikTok Shop inventory if connected
          try {
            const { updateTikTokInventory, isTikTokShopConnected } = await import("@/lib/tiktokShop");
            const { listResolvedProducts } = await import("@/lib/resolvedProducts");
            const { getTotalStock } = await import("@/lib/productsStore");

            if (await isTikTokShopConnected()) {
              // Get the full product to calculate stock
              const allProducts = await listResolvedProducts();
              const fullProduct = allProducts.find(p => p.slug === productInfo.slug);

              if (fullProduct) {
                const newStock = getTotalStock(fullProduct);

                // Update TikTok Shop
                await updateTikTokInventory(fullProduct.sku, newStock);
                console.log(`[TikTok Shop] Updated inventory for ${fullProduct.sku} to ${newStock}`);
              }
            }
          } catch (tiktokErr) {
            // Don't fail the webhook if TikTok update fails
            console.error(`[TikTok Shop] Failed to update inventory:`, tiktokErr);
          }
        } catch (err) {
          console.error(`Stock decrement failed for ${productInfo.slug} ${variantId ? `variant ${variantId}` : ''} x${qty}`, err);
        }
      } else {
        // UNMAPPED PRODUCT - Track it anyway with special slug
        console.warn(`No product mapping found for price ${priceId} at line item ${index} - tracking as unmapped`);

        if (qty > 0) {
          const itemTotal = item.amount_total || 0;
          const productName = item.description || "Unmapped Product";

          // Create unmapped product slug using price ID
          const unmappedSlug = `unmapped-${priceId}`;

          // Add to order items with special unmapped slug
          orderItems.push({
            productSlug: unmappedSlug,
            productName: `${productName} (Not Listed)`,
            quantity: qty,
            priceCents: itemTotal,
          });

          // Add to product subtotal (for points calculation)
          productSubtotalCents += itemTotal;

          console.log(`Tracked unmapped product: ${productName} (price: ${priceId}) - can be mapped later`);
        }
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
          await createOrder(customerEmail, session.id, totalCents, orderItems, user.id, productSubtotalCents, shippingCents, taxCents);
          await completeOrder(session.id);
          console.log(`Awarded ${Math.round(productSubtotalCents / 100)} points to ${customerEmail}`);

          // Increment promotion redemption count if promotion was used
          if (promotionId) {
            try {
              await incrementRedemptions(promotionId);
              console.log(`Incremented redemption count for promotion ${promotionId}`);
            } catch (err) {
              console.error(`Failed to increment promotion redemptions:`, err);
            }
          }
        } else {
          // Guest checkout - create order without userId
          console.log(`Guest checkout for ${customerEmail} - creating guest order`);
          await createOrder(customerEmail, session.id, totalCents, orderItems, undefined, productSubtotalCents, shippingCents, taxCents);
          await completeOrder(session.id);
          console.log(`Guest order created for ${customerEmail}`);

          // Increment promotion redemption count if promotion was used
          if (promotionId) {
            try {
              await incrementRedemptions(promotionId);
              console.log(`Incremented redemption count for promotion ${promotionId}`);
            } catch (err) {
              console.error(`Failed to increment promotion redemptions:`, err);
            }
          }

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

    // Mark webhook event as processed to prevent replay attacks
    await markWebhookProcessed(event.id);
    console.log(`[Webhook] Event ${event.id} marked as processed`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}