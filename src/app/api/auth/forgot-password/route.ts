import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/userStore";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json({
      message: "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
