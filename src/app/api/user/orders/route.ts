import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/userSession";
import { getUserOrders } from "@/lib/userStore";

export async function GET() {
  try {
    const session = await requireAuth();
    const orders = await getUserOrders(session.userId, 50);

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        totalCents: o.totalCents,
        pointsEarned: o.pointsEarned,
        status: o.status,
        items: o.items,
        createdAt: o.createdAt,
        completedAt: o.completedAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Get orders error:", error);
    return NextResponse.json({ error: "Failed to get orders" }, { status: 500 });
  }
}
