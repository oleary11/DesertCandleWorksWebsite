import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/userSession";
import { getUserById, updatePassword, verifyPassword } from "@/lib/userStore";
import { validatePassword } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting protection against password change abuse
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const session = await requireAuth();
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password required" },
        { status: 400 }
      );
    }

    // Use comprehensive password validation
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Get user
    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValid = await verifyPassword(user.email, currentPassword);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Update password
    await updatePassword(session.userId, newPassword);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Password change error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
