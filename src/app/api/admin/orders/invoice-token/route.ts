import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { createInvoiceAccessToken } from "@/lib/userStore";

/**
 * Generate an invoice access token for guest orders
 * GET /api/admin/orders/invoice-token?orderId=xxx
 */
export async function GET(req: NextRequest) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
    const accessToken = await createInvoiceAccessToken(orderId);
    return NextResponse.json({ token: accessToken.token });
  } catch (error) {
    console.error("[Invoice Token] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate invoice token" },
      { status: 500 }
    );
  }
}
