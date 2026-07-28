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
export const dynamic = "force-dynamic";

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
    return NextResponse.json(refunds, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
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
    type OrderItem = typeof order.items[0] & { variantId?: string };
    const itemsToRefund = body.items || order.items.map((item: OrderItem) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      quantity: item.quantity,
      variantId: item.variantId || undefined, // Extract variantId from order item if present
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
        // Pattern matches alphanumeric characters, hyphens, and underscores (Square payment IDs can vary)
        const squarePaymentIdMatch = order.notes?.match(/Square Payment ID:\s*([A-Za-z0-9_-]+)/);
        const squarePaymentId = squarePaymentIdMatch?.[1];

        if (!squarePaymentId) {
          console.error(`[Refund] No Square payment ID found in order notes`);
          console.error(`[Refund] Order ID: ${order.id}`);
          console.error(`[Refund] Order notes: ${JSON.stringify(order.notes)}`);
          console.error(`[Refund] Payment method: ${order.paymentMethod}`);
          await updateRefundStatus(refund.id, "failed");
          return NextResponse.json(
            { error: "Square payment ID not found in order notes. The order may be from an older version or the notes field is missing." },
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

        if (!squareRefund.refund?.id) {
          throw new Error("Square refund did not return an ID");
        }

        paymentRefundId = squareRefund.refund.id;
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

        // Website orders are normally keyed by their Checkout Session (`cs_...`),
        // while Stripe refunds require the underlying PaymentIntent or Charge.
        let paymentIntentId: string | undefined;
        let chargeId: string | undefined;

        if (order.id.startsWith("cs_")) {
          const checkoutSession = await stripe.checkout.sessions.retrieve(order.id);
          paymentIntentId =
            typeof checkoutSession.payment_intent === "string"
              ? checkoutSession.payment_intent
              : checkoutSession.payment_intent?.id;

          if (!paymentIntentId) {
            throw new Error(
              `Stripe Checkout Session ${order.id} does not have a refundable PaymentIntent`
            );
          }
        } else if (order.id.startsWith("pi_")) {
          paymentIntentId = order.id;
        } else if (order.id.startsWith("ch_")) {
          chargeId = order.id;
        } else {
          const savedSessionId = order.notes?.match(
            /Stripe Checkout Session:\s*(cs_[A-Za-z0-9_]+)/,
          )?.[1];

          let checkoutSession: Stripe.Checkout.Session | undefined;
          if (savedSessionId) {
            checkoutSession = await stripe.checkout.sessions.retrieve(savedSessionId);
          } else if (order.createdAt) {
            // Legacy ST orders did not save their Checkout Session ID. Resolve
            // them conservatively using multiple immutable payment attributes.
            const createdAtSeconds = Math.floor(
              new Date(order.createdAt).getTime() / 1000,
            );
            const candidates = await stripe.checkout.sessions.list({
              created: {
                gte: createdAtSeconds - 60 * 60,
                lte: createdAtSeconds + 60 * 60,
              },
              limit: 100,
            });
            const normalizedEmail = order.email.trim().toLowerCase();
            const matches = candidates.data.filter((candidate) => {
              const candidateEmail = (
                candidate.customer_details?.email ||
                candidate.customer_email ||
                ""
              ).trim().toLowerCase();
              return (
                candidate.payment_status === "paid" &&
                candidate.amount_total === order.totalCents &&
                candidateEmail === normalizedEmail
              );
            });

            if (matches.length === 1) {
              checkoutSession = matches[0];
            } else if (matches.length > 1) {
              throw new Error(
                `Found multiple Stripe payments matching order ${order.id}; refund must be reviewed manually`
              );
            }
          }

          paymentIntentId =
            typeof checkoutSession?.payment_intent === "string"
              ? checkoutSession.payment_intent
              : checkoutSession?.payment_intent?.id;

          if (!paymentIntentId) {
            throw new Error(
              `Could not safely match order ${order.id} to its Stripe payment`
            );
          }
        }

        // Create Stripe refund
        const stripeRefund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          charge: chargeId,
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

      // Send our branded confirmation only after the payment processor has
      // accepted the refund. Email delivery must never roll back a refund.
      try {
        const { sendRefundConfirmationEmail } = await import("@/lib/refundEmails");
        await sendRefundConfirmationEmail(order, refund);
        console.log(`[Refund] Confirmation email sent to ${order.email}`);
      } catch (emailError) {
        console.error("[Refund] Refund succeeded but confirmation email failed:", emailError);
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
