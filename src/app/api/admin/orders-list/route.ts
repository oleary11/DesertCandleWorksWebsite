import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";

export const runtime = "nodejs";

type OrderListItem = {
  id: string;
  email: string;
  customerName: string;
  createdAt: string;
  status: string;
  totalCents: number;
};

/**
 * GET /api/admin/orders-list
 * Fetch simplified order list for selection modals
 */
export async function GET(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await getAllOrders();

    const orderList: OrderListItem[] = orders
      .filter(order => !order.email.includes("@admin.local"))
      .map(order => ({
        id: order.id,
        email: order.email,
        customerName: order.shippingAddress?.name || order.email.split('@')[0],
        createdAt: order.createdAt,
        status: order.status,
        totalCents: order.totalCents,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ orders: orderList });
  } catch (error) {
    console.error("[Orders List] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders", details: String(error) },
      { status: 500 }
    );
  }
}
