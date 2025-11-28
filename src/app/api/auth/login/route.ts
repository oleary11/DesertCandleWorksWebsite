import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/userStore";
import { createUserSession } from "@/lib/userSession";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Verify credentials
    const user = await verifyPassword(email, password);

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Create session
    await createUserSession(user.id, user.email);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
