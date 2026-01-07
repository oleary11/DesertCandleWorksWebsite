import { NextRequest, NextResponse } from "next/server";
import { getShipment } from "@/lib/shipstation";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * POST /api/shipstation/webhook
 * Handles ShipStation webhook notifications (primarily SHIP_NOTIFY for tracking updates)
 *
 * ShipStation webhook process:
 * 1. ShipStation POSTs minimal payload with resource_url
 * 2. We fetch full shipment details from resource_url
 * 3. Update our order with tracking number and carrier info
 * 4. Respond quickly with 200 (ShipStation requires response within 10 seconds)
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { resource_url, resource_type } = payload;

    console.log(`[ShipStation Webhook] Received ${resource_type} event`);

    // Only process SHIP_NOTIFY events (when labels are created)
    if (resource_type !== "SHIP_NOTIFY") {
      console.log(`[ShipStation Webhook] Ignoring event type: ${resource_type}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!resource_url) {
      console.error("[ShipStation Webhook] No resource_url provided");
      return NextResponse.json({ error: "Missing resource_url" }, { status: 400 });
    }

    // Fetch shipment details from ShipStation
    const shipments = await getShipment(resource_url);

    if (!shipments || shipments.length === 0) {
      console.warn("[ShipStation Webhook] No shipments found in resource");
      return NextResponse.json({ received: true, warning: "No shipments found" }, { status: 200 });
    }

    // Process each shipment and update corresponding orders
    for (const shipment of shipments) {
      const {
        orderNumber,
        trackingNumber,
        carrierCode,
        serviceCode,
        shipDate,
        voided
      } = shipment;

      if (!orderNumber || !trackingNumber) {
        console.warn("[ShipStation Webhook] Shipment missing orderNumber or trackingNumber:", shipment);
        continue;
      }

      // Skip voided shipments
      if (voided) {
        console.log(`[ShipStation Webhook] Skipping voided shipment for order ${orderNumber}`);
        continue;
      }

      try {
        // Update order in database with tracking information
        const updateResult = await db
          .update(orders)
          .set({
            trackingNumber,
            carrierCode,
            serviceCode,
            shippingStatus: "shipped",
            shippedAt: shipDate ? new Date(shipDate) : new Date(),
          })
          .where(eq(orders.id, orderNumber))
          .returning({ id: orders.id });

        if (updateResult.length === 0) {
          console.warn(`[ShipStation Webhook] Order ${orderNumber} not found in database`);
          continue;
        }

        console.log(`[ShipStation Webhook] Updated order ${orderNumber} with tracking: ${trackingNumber} (${carrierCode}/${serviceCode})`);
      } catch (dbError) {
        console.error(`[ShipStation Webhook] Failed to update order ${orderNumber}:`, dbError);
        // Continue processing other shipments
      }
    }

    // Respond quickly to acknowledge receipt (ShipStation requires response within 10 seconds)
    return NextResponse.json({ received: true, processed: shipments.length }, { status: 200 });

  } catch (error) {
    console.error("[ShipStation Webhook] Error processing webhook:", error);
    // Still return 200 to prevent ShipStation from retrying
    // Log the error for manual investigation
    return NextResponse.json({ error: "Internal error", received: true }, { status: 200 });
  }
}
