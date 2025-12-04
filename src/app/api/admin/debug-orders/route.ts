import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

export async function GET() {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all orders
    const orders = await getAllOrders();

    // Get raw Redis index
    const orderIndex = await kv.smembers("orders:index");

    // Get each order individually to see what's actually stored
    const rawOrders: unknown[] = [];
    if (orderIndex && orderIndex.length > 0) {
      for (const orderId of orderIndex) {
        const order = await kv.get(`order:${orderId}`);
        rawOrders.push(order);
      }
    }

    return NextResponse.json({
      ordersFromGetAllOrders: orders,
      orderIndexKeys: orderIndex,
      rawOrdersFromRedis: rawOrders,
      stats: {
        totalOrders: orders.length,
        completedOrders: orders.filter(o => o.status === "completed").length,
        pendingOrders: orders.filter(o => o.status === "pending").length,
      }
    });
  } catch (error) {
    console.error("[Debug Orders] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders", details: String(error) },
      { status: 500 }
    );
  }
}
