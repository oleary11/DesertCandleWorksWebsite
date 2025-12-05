import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";

export const runtime = "nodejs";

/**
 * DEBUG endpoint to check order search issues
 * GET /api/admin/debug-order-search?email=x
 */
export async function GET(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const emailQuery = searchParams.get("email");

  try {
    const allOrders = await getAllOrders();

    if (emailQuery) {
      const normalizedQuery = emailQuery.toLowerCase().trim();

      // Find all orders matching this email
      const matchingOrders = allOrders.filter(
        (order) => order.email.toLowerCase() === normalizedQuery
      );

      return NextResponse.json({
        query: emailQuery,
        normalizedQuery,
        totalOrders: allOrders.length,
        matchingOrders: matchingOrders.length,
        orders: matchingOrders.map((o) => ({
          id: o.id,
          email: o.email,
          createdAt: o.createdAt,
          status: o.status,
          totalCents: o.totalCents,
          items: o.items,
        })),
        allEmails: allOrders.map((o) => o.email).filter((email, index, self) => self.indexOf(email) === index),
      });
    }

    // Return all orders if no email specified
    return NextResponse.json({
      totalOrders: allOrders.length,
      orders: allOrders.map((o) => ({
        id: o.id,
        email: o.email,
        createdAt: o.createdAt,
        status: o.status,
        totalCents: o.totalCents,
        items: o.items,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to debug order search", details: String(error) },
      { status: 500 }
    );
  }
}
