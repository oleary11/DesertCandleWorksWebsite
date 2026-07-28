import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPriceToProduct } from "@/lib/pricemap";
import { incrStock, incrVariantStock } from "@/lib/productsStore";
import { getUserByEmail, createOrder, completeOrder, redeemPoints, isWebhookProcessed, markWebhookProcessed, generateOrderId } from "@/lib/userStore";
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

  // Handle refund events
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;

    console.log(`[Webhook] Refund processed for charge ${charge.id}`);

    // Refund is already tracked in our system via the admin refund API
    // This webhook just logs it for confirmation
    // The inventory restoration and points deduction happen in the refund API

    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // SECURITY: Idempotency check - prevent webhook replay attacks by tracking event IDs
    // Check if this specific webhook event was already processed
    if (await isWebhookProcessed(event.id)) {
      console.log(`[Webhook] Event ${event.id} already processed - skipping (replay protection)`);
      return NextResponse.json({ received: true, skipped: "event_already_processed" }, { status: 200 });
    }

    // Generate a sequential order ID (format: ST00001, ST00002, etc.)
    const orderId = await generateOrderId('stripe');

    // Additional check: verify order wasn't already processed (defense in depth)
    const { getOrderById } = await import("@/lib/userStore");
    const existingOrder = await getOrderById(orderId);
    if (existingOrder && existingOrder.status === "completed") {
      // Verify order completeness by checking item count and total
      const sessionTotal = session.amount_total || 0;
      const orderTotal = existingOrder.totalCents;

      // If totals match, order is complete and correct - skip reprocessing
      if (orderTotal === sessionTotal) {
        console.log(`[Webhook] Order ${orderId} already processed correctly - skipping (replay protection)`);
        return NextResponse.json({ received: true, skipped: "already_processed" }, { status: 200 });
      }

      // If totals don't match, order may be incomplete - log warning and reprocess
      console.warn(`[Webhook] Order ${orderId} exists but totals don't match (Stripe: ${sessionTotal}, DB: ${orderTotal}) - reprocessing to fix`);
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceToProduct = await getPriceToProduct();

    // SECURITY: Verify expected subtotal matches actual subtotal from Stripe
    // This prevents attacks where someone creates a Stripe session with manipulated prices
    const expectedSubtotalCents = session.metadata?.expectedSubtotalCents
      ? parseInt(session.metadata.expectedSubtotalCents)
      : null;

    if (expectedSubtotalCents !== null) {
      // Calculate actual product subtotal from line items (excluding shipping/tax)
      const actualSubtotalCents = lineItems.data.reduce((sum, item) => {
        return sum + (item.amount_total || 0);
      }, 0);

      // Verify subtotals match
      if (actualSubtotalCents !== expectedSubtotalCents) {
        console.error(
          `[Webhook Security] Order total mismatch detected! Expected: ${expectedSubtotalCents}, Got: ${actualSubtotalCents}. Session: ${session.id}`
        );

        // Log the discrepancy but don't block the order
        // The customer already paid through Stripe, so we need to fulfill it
        // However, we should investigate this as potential fraud
        console.warn(
          `[Webhook Security] Proceeding with order ${orderId} despite total mismatch - manual review recommended`
        );
      } else {
        console.log(`[Webhook] Order total verified: ${actualSubtotalCents} cents`);
      }
    } else {
      console.warn(`[Webhook] No expected subtotal in metadata - order created before security update`);
    }

    const customerEmail = session.customer_details?.email || "";
    const pointsRedeemed = session.metadata?.pointsRedeemed ? parseInt(session.metadata.pointsRedeemed) : 0;
    const sessionUserId = session.metadata?.userId || "";
    const promotionId = session.metadata?.promotionId || "";
    const orderItems: Array<{
      productSlug: string;
      productName: string;
      variantId?: string;
      sizeName?: string;
      quantity: number;
      priceCents: number;
    }> = [];

    // Extract order totals from Stripe session
    const totalCents = session.amount_total || 0; // Full order total (products + shipping + tax)
    const shippingCents = session.total_details?.amount_shipping || 0;
    const taxCents = session.total_details?.amount_tax || 0;

    // Extract shipping address from Stripe session
    // Stripe uses "shipping_details" field when shipping is collected via shipping_address_collection
    // We also check session metadata where we store pre-validated addresses
    // TypeScript types don't include shipping_details, so we use a type assertion
    interface SessionWithShippingDetails {
      shipping_details?: {
        name?: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        };
      };
    }
    const sessionWithShipping = session as Stripe.Checkout.Session & SessionWithShippingDetails;

    let shippingAddress: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    } | undefined;

    // First, try to get from Stripe's shipping_details (used when Stripe collects the address)
    if (sessionWithShipping.shipping_details?.address) {
      shippingAddress = {
        name: sessionWithShipping.shipping_details.name || undefined,
        line1: sessionWithShipping.shipping_details.address.line1 || undefined,
        line2: sessionWithShipping.shipping_details.address.line2 || undefined,
        city: sessionWithShipping.shipping_details.address.city || undefined,
        state: sessionWithShipping.shipping_details.address.state || undefined,
        postalCode: sessionWithShipping.shipping_details.address.postal_code || undefined,
        country: sessionWithShipping.shipping_details.address.country || undefined,
      };
      console.log(`[Webhook] Shipping address from Stripe shipping_details: ${shippingAddress.city}, ${shippingAddress.state}`);
    }
    // Fallback: Check session metadata (used when we pre-validate the address)
    else if (session.metadata?.shipping_line1) {
      shippingAddress = {
        name: session.metadata.shipping_name || undefined,
        line1: session.metadata.shipping_line1,
        line2: session.metadata.shipping_line2 || undefined,
        city: session.metadata.shipping_city || undefined,
        state: session.metadata.shipping_state || undefined,
        postalCode: session.metadata.shipping_zip || undefined,
        country: session.metadata.shipping_country || undefined,
      };
      console.log(`[Webhook] Shipping address from session metadata: ${shippingAddress.city}, ${shippingAddress.state}`);
    }
    // Log warning if no shipping address found
    else {
      console.warn(`[Webhook] No shipping address found in session ${session.id}`);
    }

    // Extract phone number
    const phone = session.customer_details?.phone || undefined;

    // Retrieve the shipping rate selected by the customer in Stripe.
    // Its metadata tells us whether this is a carrier shipment or local pickup.
    let selectedShippingMethod = "Carrier shipping";
    let selectedShippingType = "carrier";
    try {
      const shippingRateRef = session.shipping_cost?.shipping_rate;
      const shippingRateId =
        typeof shippingRateRef === "string"
          ? shippingRateRef
          : shippingRateRef?.id;
      if (shippingRateId) {
        const selectedRate = await stripe.shippingRates.retrieve(shippingRateId);
        selectedShippingMethod = selectedRate.display_name || selectedShippingMethod;
        selectedShippingType = selectedRate.metadata?.shipping_type || selectedShippingType;
      }
    } catch (shippingRateError) {
      console.error("[Webhook] Could not retrieve selected Stripe shipping rate:", shippingRateError);
    }

    // Calculate product subtotal (EXCLUDING shipping and tax)
    let productSubtotalCents = 0;

    // Process line items for stock and order details
    for (let index = 0; index < lineItems.data.length; index++) {
      const item = lineItems.data[index];
      const qty = item.quantity ?? 1;

      // Home Goods items have no real Stripe Price to reverse-lookup from —
      // checkout stored the slug + bottleId directly in session metadata.
      if (session.metadata?.[`item_${index}_type`] === "home_goods") {
        const slug = session.metadata?.[`item_${index}_slug`];
        const bottleId = session.metadata?.[`item_${index}_variant`];
        const productName = session.metadata?.[`item_${index}_name`] || item.description || "Home Goods Item";
        const itemTotal = item.amount_total || 0;

        if (slug && qty > 0) {
          orderItems.push({
            productSlug: slug,
            productName,
            variantId: bottleId || undefined,
            quantity: qty,
            priceCents: itemTotal,
          });
          productSubtotalCents += itemTotal;

          if (bottleId) {
            try {
              const { decrementBottleStockForSale } = await import("@/lib/bottleInventoryStore");
              const { listResolvedProducts } = await import("@/lib/resolvedProducts");
              const allProducts = await listResolvedProducts();
              const product = allProducts.find((p) => p.slug === slug);
              console.log(`Decrementing bottle stock: ${bottleId} x${qty} (requiresUncut=${!!product?.requiresUncut})`);
              await decrementBottleStockForSale(bottleId, qty, product?.requiresUncut);
            } catch (err) {
              console.error(`Bottle stock decrement failed for ${slug} bottle ${bottleId} x${qty}`, err);
            }
          }
        } else {
          console.warn(`Home Goods line item ${index} missing slug in session metadata - skipping stock decrement`);
        }
        continue;
      }

      // Get price ID from session metadata (set during checkout)
      const priceId = session.metadata?.[`item_${index}_price`] || item.price?.id || "";
      const productInfo = priceToProduct.get(priceId);

      if (productInfo && qty > 0) {
        const itemTotal = item.amount_total || 0;

        // Get product name, size, and variant from session metadata (stored during checkout)
        const productName = session.metadata?.[`item_${index}_name`] || item.description || "Unknown Product";
        const sizeName = session.metadata?.[`item_${index}_sizeName`];
        const variantId = session.metadata?.[`item_${index}_variant`];

        // Add to order items
        orderItems.push({
          productSlug: productInfo.slug,
          productName,
          variantId: variantId || undefined,
          sizeName: sizeName || undefined,
          quantity: qty,
          priceCents: itemTotal,
        });

        // Add to product subtotal (for points calculation)
        productSubtotalCents += itemTotal;

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
              await redeemPoints(user.id, pointsRedeemed, `Redeemed for order #${orderId}`);
              console.log(`Redeemed ${pointsRedeemed} points for ${customerEmail}`);
            } catch (err) {
              console.error(`Failed to redeem points for ${customerEmail}:`, err);
            }
          }

          // User has an account - create order and award points
          // IMPORTANT: Use productSubtotalCents (products only, no shipping/tax) for points
          console.log(`Creating order for user ${user.id} (${customerEmail})`);
          await createOrder(customerEmail, orderId, totalCents, orderItems, user.id, productSubtotalCents, shippingCents, taxCents, "stripe", `Stripe Checkout Session: ${session.id}`, shippingAddress, phone);
          await completeOrder(orderId);
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
          await createOrder(customerEmail, orderId, totalCents, orderItems, undefined, productSubtotalCents, shippingCents, taxCents, "stripe", `Stripe Checkout Session: ${session.id}`, shippingAddress, phone);
          await completeOrder(orderId);
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
          await sendOrderInvoiceEmail(orderId);
          console.log(`Invoice email sent to ${customerEmail}`);
        } catch (emailErr) {
          console.error(`Failed to send invoice email to ${customerEmail}:`, emailErr);
          // Don't throw - order is already created
        }

        // Push carrier-shipped orders to Shippo for manual label purchasing.
        // Local pickup orders remain in this site's order dashboard only.
        if (
          shippingAddress?.line1 &&
          shippingAddress.city &&
          shippingAddress.state &&
          shippingAddress.postalCode &&
          selectedShippingType !== "local_pickup"
        ) {
          try {
            const { createShippoOrder, getProductWeight } = await import("@/lib/shippo");
            const { listResolvedProducts } = await import("@/lib/resolvedProducts");
            const products = await listResolvedProducts();
            const productsBySlug = new Map(products.map(product => [product.slug, product]));

            const shippoOrder = await createShippoOrder({
              orderNumber: orderId,
              stripeSessionId: session.id,
              placedAt: new Date(session.created * 1000).toISOString(),
              email: customerEmail,
              phone,
              toAddress: {
                name: shippingAddress.name,
                line1: shippingAddress.line1,
                line2: shippingAddress.line2,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postalCode: shippingAddress.postalCode,
                country: shippingAddress.country,
              },
              lineItems: orderItems.map(item => {
                const product = productsBySlug.get(item.productSlug);
                return {
                  sku: product?.sku || item.productSlug,
                  title: item.productName,
                  variantTitle: item.sizeName || item.variantId,
                  quantity: item.quantity,
                  totalPriceCents: item.priceCents,
                  weightOz: getProductWeight(product, item.sizeName),
                };
              }),
              subtotalCents: productSubtotalCents,
              totalCents,
              taxCents,
              shippingCents,
              shippingMethod: selectedShippingMethod,
            });
            console.log(`[Shippo] Order ${orderId} synced (${shippoOrder.object_id})`);
          } catch (shippoError) {
            // Payment and local order creation have already succeeded. Do not
            // make checkout fulfillment fail solely because Shippo is down.
            console.error(`[Shippo] Failed to sync order ${orderId}:`, shippoError);
          }
        } else if (selectedShippingType === "local_pickup") {
          console.log(`[Shippo] Skipping local-pickup order ${orderId}`);
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
