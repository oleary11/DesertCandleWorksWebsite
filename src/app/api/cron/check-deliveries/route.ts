import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, updateOrderShipping } from "@/lib/userStore";
import { checkDeliveryStatus } from "@/lib/uspsTracking";
import { sendDeliveryConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * GET /api/cron/check-deliveries
 * Cron job to check tracking status of shipped orders and auto-send delivery emails
 *
 * Runs every 6 hours via Vercel Cron
 */
export async function GET(req: NextRequest) {
  try {
    // SECURITY: Verify cron secret to prevent unauthorized access
    // This check is mandatory - if no secret is configured, reject all requests
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Cron] Unauthorized check-deliveries attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting delivery check...");

    // Get all orders
    const orders = await getAllOrders();

    // Filter to only shipped orders (not yet delivered)
    const shippedOrders = orders.filter(
      (order) =>
        order.trackingNumber &&
        order.shippingStatus === "shipped" &&
        !order.deliveredAt
    );

    console.log(`[Cron] Found ${shippedOrders.length} shipped orders to check`);

    const results = {
      checked: 0,
      delivered: 0,
      errors: 0,
      skipped: 0,
    };

    // Check each shipped order
    for (const order of shippedOrders) {
      try {
        results.checked++;

        // Check USPS tracking status
        const trackingResult = await checkDeliveryStatus(order.trackingNumber!);

        if (trackingResult.error) {
          console.error(`[Cron] Error checking ${order.id}: ${trackingResult.error}`);
          results.errors++;
          continue;
        }

        if (trackingResult.delivered) {
          console.log(`[Cron] Package delivered for order ${order.id}`);

          // Update order status to delivered
          await updateOrderShipping(order.id, order.trackingNumber!, "delivered");

          // Send delivery confirmation email
          try {
            await sendDeliveryConfirmationEmail(order.id, order.trackingNumber!);
            console.log(`[Cron] Delivery email sent for order ${order.id}`);
            results.delivered++;
          } catch (emailError) {
            console.error(`[Cron] Failed to send delivery email for ${order.id}:`, emailError);
            results.errors++;
          }
        } else {
          console.log(`[Cron] Order ${order.id} still in transit: ${trackingResult.status}`);
          results.skipped++;
        }

        // Add delay between checks to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Cron] Failed to process order ${order.id}:`, error);
        results.errors++;
      }
    }

    console.log("[Cron] Delivery check complete:", results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("[Cron] Delivery check failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check deliveries",
      },
      { status: 500 }
    );
  }
}
