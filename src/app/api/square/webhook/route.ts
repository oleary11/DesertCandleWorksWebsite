import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { incrStock, incrVariantStock } from "@/lib/productsStore";
import { createOrder, completeOrder, generateOrderId } from "@/lib/userStore";
import { logAdminAction } from "@/lib/adminLogs";
import { getSquareProductMapping } from "@/lib/squareMapping";

export const runtime = "nodejs";

/**
 * Square Webhook Handler
 * Receives notifications from Square when payments are completed
 *
 * Setup:
 * 1. Go to Square Developer Dashboard: https://developer.squareup.com/apps
 * 2. Select your application
 * 3. Go to Webhooks section
 * 4. Add webhook URL: https://yourdomain.com/api/square/webhook
 * 5. Subscribe to: payment.updated
 * 6. Copy the Signature Key to SQUARE_WEBHOOK_SIGNATURE_KEY env var
 */

/**
 * GET handler for Square webhook verification
 * Square may send GET requests to verify the endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: "Square webhook endpoint is active",
    status: "ready"
  }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!signatureKey) {
    console.error("[Square Webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Get request body and signature
  const body = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature");

  if (!signature) {
    console.error("[Square Webhook] Missing signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify webhook signature
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, ""); // Remove trailing slash
  const webhookUrl = baseUrl + "/api/square/webhook";
  const signatureBody = webhookUrl + body;
  const expectedSignature = crypto
    .createHmac("sha256", signatureKey)
    .update(signatureBody)
    .digest("base64");

  if (signature !== expectedSignature) {
    console.error("[Square Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse webhook event
  let event: {
    type: string;
    event_id: string;
    data?: {
      type?: string;
      id?: string;
      object?: {
        payment?: {
          id: string;
          order_id?: string;
          status: string;
          amount_money?: { amount: number; currency: string };
          total_money?: { amount: number; currency: string };
          receipt_url?: string;
          receipt_number?: string;
        };
      };
    };
  };

  try {
    event = JSON.parse(body);
  } catch (err) {
    console.error("[Square Webhook] Invalid JSON:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[Square Webhook] Received event: ${event.type} (${event.event_id})`);

  // Handle payment completed event
  if (event.type === "payment.updated") {
    const payment = event.data?.object?.payment;

    if (!payment) {
      console.error("[Square Webhook] Missing payment data");
      return NextResponse.json({ error: "Missing payment data" }, { status: 400 });
    }

    // Only process completed payments
    if (payment.status !== "COMPLETED") {
      console.log(`[Square Webhook] Payment ${payment.id} not completed (status: ${payment.status})`);
      return NextResponse.json({ received: true, skipped: "not_completed" }, { status: 200 });
    }

    console.log(`[Square Webhook] Processing completed payment: ${payment.id}`);

    try {
      // Fetch full order details from Square API
      const { SquareClient, SquareEnvironment } = await import("square");
      const accessToken = process.env.SQUARE_ACCESS_TOKEN;

      if (!accessToken) {
        throw new Error("SQUARE_ACCESS_TOKEN not configured");
      }

      const client = new SquareClient({
        token: accessToken,
        environment: process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
      });

      // Get order details if order_id is present
      let orderDetails;
      if (payment.order_id) {
        try {
          const response = await client.orders.get({ orderId: payment.order_id });
          orderDetails = response.order;
        } catch (orderErr) {
          console.error("[Square Webhook] Failed to fetch order details:", orderErr);
          // Continue without order details
        }
      }

      // Generate sequential order ID for our system (format: SQ00001, SQ00002, etc.)
      const squareOrderId = await generateOrderId('square');

      // Parse line items from order
      const orderItems: Array<{
        productSlug: string;
        productName: string;
        quantity: number;
        priceCents: number;
      }> = [];

      let totalCents = 0;
      let productSubtotalCents = 0;
      let taxCents = 0;

      // Extract tax from order details
      if (orderDetails?.totalTaxMoney?.amount) {
        taxCents = typeof orderDetails.totalTaxMoney.amount === 'bigint'
          ? Number(orderDetails.totalTaxMoney.amount)
          : (typeof orderDetails.totalTaxMoney.amount === 'string'
            ? parseInt(orderDetails.totalTaxMoney.amount)
            : orderDetails.totalTaxMoney.amount);
      }

      if (orderDetails?.lineItems) {
        const { getProductFromSquareVariation } = await import("@/lib/squareMapping");

        for (const item of orderDetails.lineItems) {
          const quantity = parseInt(item.quantity || "1");

          // Use base price (excluding tax) for item price
          const itemBasePrice = typeof item.basePriceMoney?.amount === 'bigint'
            ? Number(item.basePriceMoney.amount)
            : (typeof item.basePriceMoney?.amount === 'string'
              ? parseInt(item.basePriceMoney.amount)
              : (item.basePriceMoney?.amount ?? 0));

          const itemTotalPrice = itemBasePrice * quantity;

          // Try to map Square variation ID to our product + variant
          const catalogVariationId = item.catalogObjectId; // This is actually the variation ID
          const productInfo = catalogVariationId ? await getProductFromSquareVariation(catalogVariationId) : null;

          if (productInfo) {
            // Mapped product - decrement stock
            orderItems.push({
              productSlug: productInfo.slug,
              productName: item.name || productInfo.slug,
              quantity,
              priceCents: itemTotalPrice,
              ...(productInfo.variantId && { variantId: productInfo.variantId }), // Include variantId if present for refund processing
            });

            productSubtotalCents += itemTotalPrice;

            // Decrement stock
            try {
              if (productInfo.variantId) {
                console.log(`[Square Webhook] Decrementing variant stock: ${productInfo.slug} variant ${productInfo.variantId} x${quantity}`);
                await incrVariantStock(productInfo.slug, productInfo.variantId, -quantity);
              } else {
                console.log(`[Square Webhook] Decrementing base stock: ${productInfo.slug} x${quantity}`);
                await incrStock(productInfo.slug, -quantity);
              }
            } catch (stockErr) {
              console.error(`[Square Webhook] Stock decrement failed for ${productInfo.slug}:`, stockErr);
              // Continue processing - log the error but don't fail the webhook
            }
          } else {
            // Unmapped product - track it anyway
            console.warn(`[Square Webhook] No mapping found for variation ${catalogVariationId} - tracking as unmapped`);

            orderItems.push({
              productSlug: catalogVariationId ? `square-${catalogVariationId}` : "square-unmapped",
              productName: item.name || "Square Item (Unmapped)",
              quantity,
              priceCents: itemTotalPrice,
            });

            productSubtotalCents += itemTotalPrice;
          }
        }
      } else {
        // No line items - just use total amount minus tax
        console.warn("[Square Webhook] No line items found, using total amount");
        const totalAmount = typeof payment.total_money?.amount === 'string'
          ? parseInt(payment.total_money.amount)
          : (payment.total_money?.amount ?? 0);

        orderItems.push({
          productSlug: "square-pos-sale",
          productName: "Square POS Sale",
          quantity: 1,
          priceCents: totalAmount - taxCents,
        });
        productSubtotalCents = totalAmount - taxCents;
      }

      totalCents = typeof payment.total_money?.amount === 'string'
        ? parseInt(payment.total_money.amount)
        : (payment.total_money?.amount ?? 0);

      console.log(`[Square Webhook] Order breakdown - Subtotal: $${(productSubtotalCents / 100).toFixed(2)}, Tax: $${(taxCents / 100).toFixed(2)}, Total: $${(totalCents / 100).toFixed(2)}`);

      // Create order record
      // Note: Square doesn't provide customer email via webhook, use a placeholder
      const customerEmail = "square-pos@admin.local";

      await createOrder(
        customerEmail,
        squareOrderId,
        totalCents,
        orderItems,
        undefined, // userId - no user for POS sales
        productSubtotalCents,
        undefined, // shippingCents - no shipping for POS
        taxCents, // taxCents - now properly extracted from Square order
        "square", // paymentMethod
        `Square Payment ID: ${payment.id}\nReceipt: ${payment.receipt_url || payment.receipt_number || "N/A"}` // notes
      );

      // Complete the order immediately
      await completeOrder(squareOrderId);

      console.log(`[Square Webhook] Order ${squareOrderId} created and completed - $${(totalCents / 100).toFixed(2)}`);

      // Log admin action
      await logAdminAction({
        action: "square.payment.completed",
        adminEmail: "square-pos",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        userAgent: req.headers.get("user-agent") || "Square Webhook",
        success: true,
        details: {
          squarePaymentId: payment.id,
          orderId: squareOrderId,
          totalCents,
          itemCount: orderItems.length,
          items: orderItems,
        },
      });

      return NextResponse.json({
        received: true,
        orderId: squareOrderId,
        message: "Payment processed successfully"
      }, { status: 200 });

    } catch (error) {
      console.error("[Square Webhook] Error processing payment:", error);

      await logAdminAction({
        action: "square.payment.completed",
        adminEmail: "square-pos",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        userAgent: req.headers.get("user-agent") || "Square Webhook",
        success: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
          paymentId: payment.id,
        },
      });

      return NextResponse.json({
        error: "Failed to process payment",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  }

  // Acknowledge other event types
  return NextResponse.json({ received: true }, { status: 200 });
}
