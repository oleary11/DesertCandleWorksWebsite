import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isAdminAuthed } from "@/lib/adminSession";
import { getOrderById, deductPoints } from "@/lib/userStore";
import { incrStock, incrVariantStock } from "@/lib/productsStore";
import {
  createRefund,
  listRefunds,
  updateRefundStatus,
  type Refund,
  type RefundReason,
} from "@/lib/refundStore";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * GET /api/admin/refunds - List all refunds
 */
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const refunds = await listRefunds();
    return NextResponse.json(refunds);
  } catch (error) {
    console.error("[Admin Refunds] Failed to list refunds:", error);
    return NextResponse.json(
      { error: "Failed to load refunds" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/refunds - Process a refund
 */
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.orderId || !body.reason) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, reason" },
        { status: 400 }
      );
    }

    // Get the order
    const order = await getOrderById(body.orderId);
    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "Can only refund completed orders" },
        { status: 400 }
      );
    }

    // Determine refund amount (full or partial)
    const refundAmountCents = body.amountCents || order.totalCents;

    if (refundAmountCents > order.totalCents) {
      return NextResponse.json(
        { error: "Refund amount cannot exceed order total" },
        { status: 400 }
      );
    }

    // Determine which items to refund (full or partial)
    const itemsToRefund = body.items || order.items.map((item: typeof order.items[0]) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      quantity: item.quantity,
      variantId: undefined, // Will be populated from webhook metadata if available
      refundAmountCents: item.priceCents,
    }));

    // Create refund record
    const refund: Refund = {
      id: randomUUID(),
      orderId: order.id,
      email: order.email,
      userId: order.userId,
      amountCents: refundAmountCents,
      reason: body.reason as RefundReason,
      reasonNote: body.reasonNote,
      status: "processing",
      restoreInventory: body.restoreInventory !== false, // Default true
      pointsToDeduct: body.restoreInventory !== false ? order.pointsEarned : undefined,
      processedBy: "admin", // Could track which admin user
      createdAt: new Date().toISOString(),
      items: itemsToRefund,
    };

    await createRefund(refund);

    // Detect if this is a Square order or Stripe order
    const isSquareOrder = order.id.startsWith("SQ") || order.paymentMethod === "square";

    let paymentRefundId: string;

    try {
      if (isSquareOrder) {
        // Process Square refund
        console.log(`[Refund] Processing Square refund for order ${order.id}`);

        const accessToken = process.env.SQUARE_ACCESS_TOKEN;
        if (!accessToken) {
          return NextResponse.json(
            { error: "Square not configured" },
            { status: 500 }
          );
        }

        // Extract Square payment ID from order notes
        const squarePaymentIdMatch = order.notes?.match(/Square Payment ID: ([A-Z0-9]+)/);
        const squarePaymentId = squarePaymentIdMatch?.[1];

        if (!squarePaymentId) {
          console.error(`[Refund] No Square payment ID found in order notes: ${order.notes}`);
          await updateRefundStatus(refund.id, "failed");
          return NextResponse.json(
            { error: "Square payment ID not found in order notes" },
            { status: 400 }
          );
        }

        console.log(`[Refund] Found Square payment ID: ${squarePaymentId}`);

        const { SquareClient, SquareEnvironment } = await import("square");
        const client = new SquareClient({
          token: accessToken,
          environment: process.env.SQUARE_ENVIRONMENT === "production"
            ? SquareEnvironment.Production
            : SquareEnvironment.Sandbox,
        });

        // Create Square refund
        const squareRefund = await client.refunds.refundPayment({
          idempotencyKey: refund.id,
          paymentId: squarePaymentId,
          amountMoney: {
            amount: BigInt(refundAmountCents),
            currency: "USD",
          },
          reason: body.reasonNote || body.reason,
        });

        if (!squareRefund.result.refund?.id) {
          throw new Error("Square refund did not return an ID");
        }

        paymentRefundId = squareRefund.result.refund.id;
        console.log(`[Refund] Square refund created: ${paymentRefundId}`);

        // Update refund with Square refund ID
        await updateRefundStatus(
          refund.id,
          "completed",
          paymentRefundId,
          new Date().toISOString()
        );
      } else {
        // Process Stripe refund
        console.log(`[Refund] Processing Stripe refund for order ${order.id}`);

        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
          return NextResponse.json(
            { error: "Stripe not configured" },
            { status: 500 }
          );
        }

        const stripe = new Stripe(secretKey);

        // Create Stripe refund
        const stripeRefund = await stripe.refunds.create({
          payment_intent: order.id.startsWith("pi_") ? order.id : undefined,
          charge: order.id.startsWith("ch_") ? order.id : undefined,
          amount: refundAmountCents,
          reason: mapReasonToStripe(body.reason),
          metadata: {
            refund_id: refund.id,
            order_id: order.id,
            reason: body.reason,
          },
        });

        paymentRefundId = stripeRefund.id;
        console.log(`[Refund] Stripe refund created: ${paymentRefundId}`);

        // Update refund with Stripe ID
        await updateRefundStatus(
          refund.id,
          "completed",
          paymentRefundId,
          new Date().toISOString()
        );
      }

      // Restore inventory if requested
      if (refund.restoreInventory) {
        for (const item of refund.items) {
          try {
            if (item.variantId) {
              await incrVariantStock(item.productSlug, item.variantId, item.quantity);
              console.log(`[Refund] Restored variant stock: ${item.productSlug} variant ${item.variantId} +${item.quantity}`);
            } else {
              await incrStock(item.productSlug, item.quantity);
              console.log(`[Refund] Restored stock: ${item.productSlug} +${item.quantity}`);
            }
          } catch (err) {
            console.error(`[Refund] Failed to restore stock for ${item.productSlug}:`, err);
          }
        }
      }

      // Deduct points if order earned points
      if (refund.pointsToDeduct && order.userId) {
        try {
          await deductPoints(
            order.userId,
            refund.pointsToDeduct,
            `Refund for order #${order.id.slice(0, 8)}`
          );
          console.log(`[Refund] Deducted ${refund.pointsToDeduct} points from user ${order.userId}`);
        } catch (err) {
          console.error(`[Refund] Failed to deduct points:`, err);
        }
      }

      return NextResponse.json({
        success: true,
        refund: await updateRefundStatus(refund.id, "completed", paymentRefundId, new Date().toISOString()),
        refundId: paymentRefundId,
        processor: isSquareOrder ? "square" : "stripe",
      });
    } catch (paymentError) {
      console.error(`[Admin Refunds] ${isSquareOrder ? "Square" : "Stripe"} refund failed:`, paymentError);

      // Update refund status to failed
      await updateRefundStatus(refund.id, "failed");

      return NextResponse.json(
        {
          error: `${isSquareOrder ? "Square" : "Stripe"} refund failed`,
          details: paymentError instanceof Error ? paymentError.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Admin Refunds] Refund processing error:", error);
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
}

/**
 * Map internal refund reason to Stripe refund reason
 */
function mapReasonToStripe(reason: RefundReason): "duplicate" | "fraudulent" | "requested_by_customer" {
  switch (reason) {
    case "duplicate_order":
      return "duplicate";
    case "customer_request":
    case "damaged_product":
    case "wrong_item_sent":
    case "quality_issue":
    case "shipping_delay":
    case "other":
    default:
      return "requested_by_customer";
  }
}
