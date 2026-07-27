import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getShippoDashboardOrder,
  getShippoRate,
  getShippoTransaction,
  type ShippoTransaction,
} from "@/lib/shippo";
import {
  getOrderById,
  isWebhookProcessed,
  markWebhookProcessed,
  updateOrderShipping,
} from "@/lib/userStore";
import {
  sendDeliveryConfirmationEmail,
  sendShippingConfirmationEmail,
} from "@/lib/email";

export const runtime = "nodejs";

type ShippoWebhookPayload = {
  event?: string;
  event_created_at?: string;
  data?: Record<string, unknown>;
};

function secureEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function objectId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "object_id" in value) {
    return stringValue((value as { object_id?: unknown }).object_id);
  }
  return undefined;
}

function eventFingerprint(payload: ShippoWebhookPayload): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

async function resolveTransaction(
  event: string,
  data: Record<string, unknown>
): Promise<ShippoTransaction | null> {
  if (event === "transaction_created" || event === "transaction_updated") {
    const transactionId = objectId(data.object_id);
    return transactionId ? getShippoTransaction(transactionId) : null;
  }

  if (event === "track_updated") {
    const transactionId = objectId(data.transaction);
    return transactionId ? getShippoTransaction(transactionId) : null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.SHIPPO_WEBHOOK_SECRET;
  const suppliedSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!expectedSecret || !secureEqual(suppliedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ShippoWebhookPayload;
  try {
    payload = (await req.json()) as ShippoWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event || "";
  if (!["transaction_created", "transaction_updated", "track_updated"].includes(event)) {
    return NextResponse.json({ received: true, ignored: event }, { status: 200 });
  }

  const eventId = `shippo:${eventFingerprint(payload)}`;
  if (await isWebhookProcessed(eventId)) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    const data = payload.data || {};
    const transaction = await resolveTransaction(event, data);
    if (!transaction) {
      throw new Error(`Shippo ${event} event did not include a transaction reference`);
    }

    const shippoOrderId = objectId(transaction.order);
    if (!shippoOrderId) {
      throw new Error(`Shippo transaction ${transaction.object_id} is not linked to an order`);
    }

    const shippoOrder = await getShippoDashboardOrder(shippoOrderId);
    const orderId = shippoOrder.order_number;
    const order = await getOrderById(orderId);
    if (!order) {
      throw new Error(`Website order ${orderId} was not found`);
    }

    const trackingNumber =
      stringValue(data.tracking_number) || transaction.tracking_number;
    if (!trackingNumber) {
      throw new Error(`Shippo transaction ${transaction.object_id} has no tracking number`);
    }

    let rate =
      transaction.rate && typeof transaction.rate === "object"
        ? transaction.rate
        : undefined;
    if (!rate && typeof transaction.rate === "string") {
      rate = await getShippoRate(transaction.rate);
    }
    const carrierName = rate?.provider || stringValue(data.carrier) || "Carrier";
    const serviceCode = rate?.servicelevel?.token;
    const trackingUrl =
      transaction.tracking_url_provider || stringValue(data.tracking_url_provider);
    const trackingStatusValue =
      data.tracking_status &&
      typeof data.tracking_status === "object" &&
      "status" in data.tracking_status
        ? (data.tracking_status as { status?: unknown }).status
        : undefined;
    const trackingStatus = stringValue(trackingStatusValue)?.toUpperCase() || "";

    const delivered = event === "track_updated" && trackingStatus === "DELIVERED";
    const shouldMarkShipped =
      !delivered &&
      (event === "transaction_created" ||
        event === "transaction_updated" ||
        ["PRE_TRANSIT", "TRANSIT"].includes(trackingStatus));

    if (delivered) {
      const shouldEmail = order.shippingStatus !== "delivered";
      await updateOrderShipping(orderId, trackingNumber, "delivered", {
        carrierCode: carrierName.toLowerCase(),
        serviceCode,
      });
      if (shouldEmail) {
        await sendDeliveryConfirmationEmail(orderId, trackingNumber);
      }
    } else if (shouldMarkShipped) {
      const shouldEmail =
        order.shippingStatus !== "shipped" && order.shippingStatus !== "delivered";
      await updateOrderShipping(orderId, trackingNumber, "shipped", {
        carrierCode: carrierName.toLowerCase(),
        serviceCode,
      });
      if (shouldEmail) {
        await sendShippingConfirmationEmail(orderId, trackingNumber, {
          carrierName,
          trackingUrl,
        });
      }
    }

    await markWebhookProcessed(eventId);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Shippo Webhook] Processing failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}
