import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/userStore";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Public API endpoint to view invoice using access token
 * GET /api/invoice/view?token=xxx
 */
export async function GET(req: NextRequest) {
  // Rate limiting protection against token enumeration
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rateLimitOk = await checkRateLimit(ip);

  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const order = await getOrderByToken(token);

    if (!order) {
      return NextResponse.json({ error: "Invoice not found or expired" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("[Invoice] View error:", error);
    return NextResponse.json({ error: "Failed to load invoice" }, { status: 500 });
  }
}
