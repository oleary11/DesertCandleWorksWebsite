import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/userSession";
import { getOrderById } from "@/lib/userStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requireAuth();
    const { orderId } = await params;

    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Security: Verify that the order belongs to the authenticated user
    if (order.userId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Get order error:", error);
    return NextResponse.json({ error: "Failed to get order" }, { status: 500 });
  }
}
