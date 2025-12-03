import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/userStore";
import { createUserSession } from "@/lib/userSession";
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting protection against brute force attacks
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Verify credentials
    const user = await verifyPassword(email, password);

    if (!user) {
      // Add delay on failed login to slow down brute force
      await new Promise(resolve => setTimeout(resolve, 1000));
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Reset rate limit on successful login
    await resetRateLimit(ip);

    // SECURITY: Session rotation - destroy any existing session before creating new one
    // This prevents session fixation attacks
    const { destroyUserSession } = await import("@/lib/userSession");
    await destroyUserSession();

    // Create new session with fresh token
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
