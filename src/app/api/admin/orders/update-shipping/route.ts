import { NextRequest, NextResponse } from "next/server";
import { updateOrderShipping } from "@/lib/userStore";
import { sendShippingConfirmationEmail, sendDeliveryConfirmationEmail } from "@/lib/email";
import { getAdminSession } from "@/lib/adminSession";

export const runtime = "nodejs";

/**
 * POST /api/admin/orders/update-shipping
 * Update order shipping status and send appropriate email
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, trackingNumber, shippingStatus } = body;

    // Validate input
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    if (!trackingNumber || typeof trackingNumber !== "string") {
      return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
    }

    if (!shippingStatus || !["shipped", "delivered"].includes(shippingStatus)) {
      return NextResponse.json(
        { error: "Shipping status must be 'shipped' or 'delivered'" },
        { status: 400 }
      );
    }

    // Update order with tracking info
    const updatedOrder = await updateOrderShipping(orderId, trackingNumber, shippingStatus);

    // Send appropriate email based on status
    try {
      if (shippingStatus === "shipped") {
        await sendShippingConfirmationEmail(orderId, trackingNumber);
        console.log(`[Admin] Shipping confirmation email sent for order ${orderId}`);
      } else if (shippingStatus === "delivered") {
        await sendDeliveryConfirmationEmail(orderId, trackingNumber);
        console.log(`[Admin] Delivery confirmation email sent for order ${orderId}`);
      }
    } catch (emailError) {
      console.error(`[Admin] Failed to send email for order ${orderId}:`, emailError);
      // Don't fail the request if email fails - order is still updated
      return NextResponse.json(
        {
          success: true,
          order: updatedOrder,
          warning: "Order updated but email failed to send",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        order: updatedOrder,
        message: `Order marked as ${shippingStatus} and email sent`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Admin] Update shipping error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update shipping" },
      { status: 500 }
    );
  }
}
