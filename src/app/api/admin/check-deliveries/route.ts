import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, updateOrderShipping } from "@/lib/userStore";
import { checkDeliveryStatus } from "@/lib/uspsTracking";
import { sendDeliveryConfirmationEmail } from "@/lib/email";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

/**
 * POST /api/admin/check-deliveries
 * Manually trigger delivery status check for all shipped orders
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const sessionToken = req.cookies.get("admin_session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await kv.get<{ adminId: string }>(`admin:session:${sessionToken}`);
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    console.log("[Admin] Manual delivery check initiated");

    // Get all orders
    const orders = await getAllOrders();

    // Filter to only shipped orders (not yet delivered)
    const shippedOrders = orders.filter(
      (order) =>
        order.trackingNumber &&
        order.shippingStatus === "shipped" &&
        !order.deliveredAt
    );

    console.log(`[Admin] Found ${shippedOrders.length} shipped orders to check`);

    const results = {
      checked: 0,
      delivered: 0,
      errors: 0,
      details: [] as Array<{
        orderId: string;
        trackingNumber: string;
        status: string;
        delivered: boolean;
        error?: string;
      }>,
    };

    // Check each shipped order
    for (const order of shippedOrders) {
      try {
        results.checked++;

        // Check USPS tracking status
        const trackingResult = await checkDeliveryStatus(order.trackingNumber!);

        const detail = {
          orderId: order.id.slice(0, 8).toUpperCase(),
          trackingNumber: order.trackingNumber!,
          status: trackingResult.status || "Unknown",
          delivered: trackingResult.delivered,
          error: trackingResult.error,
        };

        results.details.push(detail);

        if (trackingResult.error) {
          console.error(`[Admin] Error checking ${order.id}: ${trackingResult.error}`);
          results.errors++;
          continue;
        }

        if (trackingResult.delivered) {
          console.log(`[Admin] Package delivered for order ${order.id}`);

          // Update order status to delivered
          await updateOrderShipping(order.id, order.trackingNumber!, "delivered");

          // Send delivery confirmation email
          try {
            await sendDeliveryConfirmationEmail(order.id, order.trackingNumber!);
            console.log(`[Admin] Delivery email sent for order ${order.id}`);
            results.delivered++;
          } catch (emailError) {
            console.error(`[Admin] Failed to send delivery email for ${order.id}:`, emailError);
            results.errors++;
            detail.error = "Email failed to send";
          }
        }

        // Add delay between checks to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Admin] Failed to process order ${order.id}:`, error);
        results.errors++;
        results.details.push({
          orderId: order.id.slice(0, 8).toUpperCase(),
          trackingNumber: order.trackingNumber!,
          status: "Error",
          delivered: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log("[Admin] Manual delivery check complete:", results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("[Admin] Delivery check failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check deliveries",
      },
      { status: 500 }
    );
  }
}
