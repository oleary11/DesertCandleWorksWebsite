import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getAdminSession } from "@/lib/adminSession";
import { getOrderById } from "@/lib/userStore";
import { logAdminAction } from "@/lib/adminLogs";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

/**
 * POST /api/admin/repair-order
 * Manually add missing items to an order
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getAdminSession();
  const body = await req.json().catch(() => ({}));
  const { orderId, itemsToAdd, newTotalCents } = body;

  if (!orderId || !itemsToAdd || !Array.isArray(itemsToAdd) || itemsToAdd.length === 0) {
    await logAdminAction({
      action: "order.repair",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { reason: "invalid_input" },
    });

    return NextResponse.json(
      { error: "Order ID and items to add are required" },
      { status: 400 }
    );
  }

  try {
    // Get existing order
    const order = await getOrderById(orderId);

    if (!order) {
      await logAdminAction({
        action: "order.repair",
        adminEmail: session?.email,
        ip,
        userAgent,
        success: false,
        details: { reason: "order_not_found", orderId },
      });

      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Add new items to existing order
    const updatedOrder = {
      ...order,
      items: [...order.items, ...itemsToAdd],
      totalCents: newTotalCents || order.totalCents,
    };

    // Save updated order
    await kv.set(`order:${orderId}`, updatedOrder);

    await logAdminAction({
      action: "order.repair",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: true,
      details: {
        orderId,
        itemsAdded: itemsToAdd.length,
        newTotal: newTotalCents,
        addedItems: itemsToAdd.map((item) => ({
          slug: item.productSlug,
          name: item.productName,
          quantity: item.quantity,
        })),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    await logAdminAction({
      action: "order.repair",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { error: String(error), orderId },
    });

    return NextResponse.json(
      { error: "Failed to repair order" },
      { status: 500 }
    );
  }
}
