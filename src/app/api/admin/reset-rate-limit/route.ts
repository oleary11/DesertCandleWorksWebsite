import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { resetRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

// This endpoint allows admins to reset rate limiting for a specific IP
// Useful if you accidentally lock yourself out

export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { ip?: string };
  const ip = body.ip || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  await resetRateLimit(ip);

  return NextResponse.json({
    success: true,
    message: `Rate limit reset for IP: ${ip}`
  });
}
