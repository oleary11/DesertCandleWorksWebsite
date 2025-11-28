import { NextRequest, NextResponse } from "next/server";
import { createEmailVerificationToken, getUserById } from "@/lib/userStore";
import { sendEmailVerification } from "@/lib/email";
import { requireAuth } from "@/lib/userSession";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    // Create verification token
    const verificationToken = await createEmailVerificationToken(user.id);

    // Send verification email
    await sendEmailVerification(user.email, verificationToken.token);

    return NextResponse.json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
}
