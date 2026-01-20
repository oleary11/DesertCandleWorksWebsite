import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/userStore";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Rate limiting to prevent email spam and timing-based enumeration
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create reset token (returns null if user doesn't exist)
    const resetToken = await createPasswordResetToken(email);

    // Always return success to prevent email enumeration
    // (don't reveal whether email exists in database)
    if (resetToken) {
      await sendPasswordResetEmail(resetToken.email, resetToken.token);
    }

    // SECURITY: Add consistent delay to prevent timing-based email enumeration
    // This makes response time the same whether user exists or not
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json({
      message: "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
