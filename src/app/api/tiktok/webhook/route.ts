// TikTok Shop webhook handler for order events
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { incrStock } from "@/lib/productsStore";
import { disconnectTikTokShop } from "@/lib/tiktokShop";
import crypto from "crypto";

export const runtime = "nodejs";

type TikTokOrderItem = {
  product_id: string; // This is the SKU we sent to TikTok
  product_name: string;
  quantity: number;
  sku_id?: string;
};

type TikTokOrderEvent = {
  event: string;
  timestamp: number;
  shop_id: string;
  data: {
    order_id?: string;
    order_status?: number;
    cancel_status?: number;
    return_status?: number;
    reverse_status?: number;
    items?: TikTokOrderItem[];
    create_time?: number;
    update_time?: number;
  };
};

/**
 * Verify TikTok Shop webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
  if (!appSecret) {
    console.error("[TikTok Webhook] App secret not configured");
    return false;
  }

  // TikTok Shop webhook signature: HMAC-SHA256(app_secret, timestamp + payload)
  const message = timestamp + payload;
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(message)
    .digest("hex");

  return signature === expectedSignature;
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const signature = headersList.get("x-tiktok-shop-signature");
    const timestamp = headersList.get("x-tiktok-shop-timestamp");

    if (!signature || !timestamp) {
      console.error("[TikTok Webhook] Missing signature or timestamp headers");
      return NextResponse.json({ error: "Missing headers" }, { status: 400 });
    }

    const body = await req.text();

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature, timestamp)) {
      console.error("[TikTok Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event: TikTokOrderEvent = JSON.parse(body);

    console.log("[TikTok Webhook] Received event:", event.event, event.data);

    // Handle different event types
    switch (event.event) {
      case "order_status_change":
        await handleOrderStatusChange(event);
        break;

      case "cancellation_status_change":
        await handleCancellationStatusChange(event);
        break;

      case "order_return_status_change":
        await handleReturnStatusChange(event);
        break;

      case "reverse_status_update":
        console.log(`[TikTok Webhook] Reverse status update for order ${event.data.order_id} - requires seller action`);
        // Log for admin visibility - you may want to send an email notification here
        break;

      case "seller_deauthorization":
        console.log("[TikTok Webhook] Seller deauthorized the app - disconnecting");
        await disconnectTikTokShop();
        break;

      case "auth_expire":
        console.log("[TikTok Webhook] Authorization expiring soon - needs re-auth");
        // You may want to send an email notification here
        break;

      default:
        console.log(`[TikTok Webhook] Unhandled event type: ${event.event}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[TikTok Webhook] Processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle order completion - decrement stock
 */
async function handleOrderStatusChange(event: TikTokOrderEvent) {
  // Status 100 = Order completed/paid
  if (event.data.order_status !== 100) {
    console.log(`[TikTok Webhook] Order ${event.data.order_id} status: ${event.data.order_status} - ignoring`);
    return;
  }

  console.log(`[TikTok Webhook] Processing completed order ${event.data.order_id}`);

  if (!event.data.items) {
    console.error("[TikTok Webhook] No items in order");
    return;
  }

  for (const item of event.data.items) {
    await updateStockForItem(item, -item.quantity, "order completion");
  }
}

/**
 * Handle order cancellation - restore stock
 */
async function handleCancellationStatusChange(event: TikTokOrderEvent) {
  // Cancel status 1 = Cancelled
  if (event.data.cancel_status !== 1) {
    console.log(`[TikTok Webhook] Order ${event.data.order_id} cancel status: ${event.data.cancel_status} - ignoring`);
    return;
  }

  console.log(`[TikTok Webhook] Processing cancelled order ${event.data.order_id} - restoring stock`);

  if (!event.data.items) {
    console.error("[TikTok Webhook] No items in cancelled order");
    return;
  }

  for (const item of event.data.items) {
    await updateStockForItem(item, item.quantity, "cancellation");
  }
}

/**
 * Handle order return - restore stock
 */
async function handleReturnStatusChange(event: TikTokOrderEvent) {
  // Return status 3 = Return completed
  if (event.data.return_status !== 3) {
    console.log(`[TikTok Webhook] Order ${event.data.order_id} return status: ${event.data.return_status} - ignoring`);
    return;
  }

  console.log(`[TikTok Webhook] Processing returned order ${event.data.order_id} - restoring stock`);

  if (!event.data.items) {
    console.error("[TikTok Webhook] No items in returned order");
    return;
  }

  for (const item of event.data.items) {
    await updateStockForItem(item, item.quantity, "return");
  }
}

/**
 * Helper function to update stock for an item
 */
async function updateStockForItem(item: TikTokOrderItem, quantityChange: number, reason: string) {
  const sku = item.product_id; // We used SKU as product_id when syncing

  try {
    // Find product by SKU
    const { listResolvedProducts } = await import("@/lib/resolvedProducts");
    const products = await listResolvedProducts();
    const product = products.find(p => p.sku === sku);

    if (!product) {
      console.error(`[TikTok Webhook] Product not found for SKU: ${sku}`);
      return;
    }

    // Update stock on website
    await incrStock(product.slug, quantityChange);

    const action = quantityChange < 0 ? "Decremented" : "Restored";
    console.log(
      `[TikTok Webhook] ${action} stock for ${product.slug} (SKU: ${sku}) by ${Math.abs(quantityChange)} (reason: ${reason})`
    );
  } catch (error) {
    console.error(
      `[TikTok Webhook] Failed to update stock for SKU ${sku}:`,
      error
    );
  }
}
