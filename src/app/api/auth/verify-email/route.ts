import { NextRequest, NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/userStore";

export async function POST(req: NextRequest) {
  try {
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
