import { NextRequest, NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/userStore";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting protection against token enumeration
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const success = await verifyEmailWithToken(token);

    if (!success) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
