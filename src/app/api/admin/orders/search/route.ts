import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getAdminSession } from "@/lib/adminSession";
import { getOrderById } from "@/lib/userStore";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

/**
 * GET /api/admin/orders/search?email=x or ?orderId=y
 * Search for orders by email or order ID
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getAdminSession();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const orderId = searchParams.get("orderId");

  try {
    if (orderId) {
      // Search by order ID (supports both full and partial matches)
      // First try exact match for performance
      let order = await getOrderById(orderId);

      // If no exact match, search for partial match
      if (!order) {
        const { redis } = await import("@/lib/redis");
        const orderIds = await redis.smembers("orders:index");

        for (const id of orderIds) {
          // Case-insensitive partial match
          if (id.toLowerCase().includes(orderId.toLowerCase())) {
            order = await getOrderById(id);
            if (order) {
              break; // Use first match
            }
          }
        }
      }

      if (!order) {
        await logAdminAction({
          action: "order.search",
          adminEmail: session?.email,
          ip,
          userAgent,
          success: false,
          details: { reason: "not_found", orderId },
        });

        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      await logAdminAction({
        action: "order.search",
        adminEmail: session?.email,
        ip,
        userAgent,
        success: true,
        details: { orderId: order.id, customerEmail: order.email },
      });

      // Transform order to match frontend interface (id -> orderId)
      return NextResponse.json({
        order: {
          ...order,
          orderId: order.id,
        }
      });
    }

    if (email) {
      // Search by email - get the most recent order for this email
      // This requires iterating through orders - for now, we'll need to add a helper function
      const { redis } = await import("@/lib/redis");
      const orderIds = await redis.smembers("orders:index");

      let matchedOrder = null;
      for (const id of orderIds) {
        const order = await getOrderById(id);
        if (order && order.email.toLowerCase() === email.toLowerCase()) {
          // Get the most recent order
          if (!matchedOrder || new Date(order.createdAt) > new Date(matchedOrder.createdAt)) {
            matchedOrder = order;
          }
        }
      }

      if (!matchedOrder) {
        await logAdminAction({
          action: "order.search",
          adminEmail: session?.email,
          ip,
          userAgent,
          success: false,
          details: { reason: "not_found", email },
        });

        return NextResponse.json({ error: "No orders found for this email" }, { status: 404 });
      }

      await logAdminAction({
        action: "order.search",
        adminEmail: session?.email,
        ip,
        userAgent,
        success: true,
        details: { email, orderId: matchedOrder.id },
      });

      // Transform order to match frontend interface (id -> orderId)
      return NextResponse.json({
        order: {
          ...matchedOrder,
          orderId: matchedOrder.id,
        }
      });
    }

    return NextResponse.json(
      { error: "Please provide either email or orderId parameter" },
      { status: 400 }
    );
  } catch (error) {
    await logAdminAction({
      action: "order.search",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: "Failed to search orders" },
      { status: 500 }
    );
  }
}
