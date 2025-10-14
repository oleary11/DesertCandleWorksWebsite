import { NextRequest, NextResponse } from "next/server";
import { resetRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Emergency rate limit reset endpoint
 *
 * Use this if you're locked out and can't log in.
 * Requires EMERGENCY_RESET_TOKEN environment variable for security.
 *
 * Usage:
 * POST /api/emergency-reset
 * Body: { "token": "your-emergency-token" }
 *
 * Set EMERGENCY_RESET_TOKEN in your .env file or Vercel environment variables.
 */
export async function POST(req: NextRequest) {
  const emergencyToken = process.env.EMERGENCY_RESET_TOKEN;

  if (!emergencyToken) {
    return NextResponse.json({
      error: "Emergency reset not configured. Set EMERGENCY_RESET_TOKEN environment variable.",
    }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { token?: string };
  const providedToken = body.token;

  if (!providedToken || providedToken !== emergencyToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Reset rate limit for the requesting IP
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  await resetRateLimit(ip);

  return NextResponse.json({
    success: true,
    message: `Rate limit reset for IP: ${ip}`,
    note: "You can now try logging in again"
  });
}
