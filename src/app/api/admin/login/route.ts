import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, destroyAdminSession } from "@/lib/adminSession";
import { authenticateAdminUser, verifyAdminTwoFactorToken, updateAdminLastLogin } from "@/lib/adminUsers";
import { logAdminAction } from "@/lib/adminLogs";
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Get request metadata for logging
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Rate limiting
  const rateLimitOk = await checkRateLimit(ip);
  if (!rateLimitOk) {
    await logAdminAction({
      action: "login",
      ip,
      userAgent,
      success: false,
      details: { reason: "rate_limited" },
    });

    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  const ctype = req.headers.get("content-type") || "";
  let email = "";
  let password = "";
  let twoFactorToken = "";
  let next = "/admin";

  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      twoFactorToken?: string;
      next?: string;
    };
    email = (body.email ?? "").toString();
    password = (body.password ?? "").toString();
    twoFactorToken = (body.twoFactorToken ?? "").toString();
    next = (body.next ?? "/admin").toString();
  } else {
    const form = await req.formData();
    email = (form.get("email") ?? "").toString();
    password = (form.get("password") ?? "").toString();
    twoFactorToken = (form.get("twoFactorToken") ?? "").toString();
    next = (form.get("next") ?? "/admin").toString();
  }

  // Validate input
  if (!email || !password) {
    await logAdminAction({
      action: "login",
      adminEmail: email || undefined,
      ip,
      userAgent,
      success: false,
      details: { reason: "missing_credentials" },
    });

    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // SECURITY: Validate redirect URL to prevent open redirect attacks
  if (next && (!next.startsWith("/admin") && !next.startsWith("/api/admin"))) {
    next = "/admin"; // Only allow admin paths
  }

  // Authenticate admin user
  const user = await authenticateAdminUser(email, password);

  if (!user) {
    await logAdminAction({
      action: "login",
      adminEmail: email,
      ip,
      userAgent,
      success: false,
      details: { reason: "invalid_credentials" },
    });

    // Add delay to slow down brute force
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // 2FA is MANDATORY - check if token provided
  if (!twoFactorToken) {
    // Credentials correct but need 2FA token
    return NextResponse.json({
      requiresTwoFactor: true,
      userId: user.id, // Needed for 2FA verification
      message: "Please enter your 2FA code",
    });
  }

  // Verify 2FA token (mandatory for all admin users)
  const isValidToken = await verifyAdminTwoFactorToken(user.id, twoFactorToken);
  if (!isValidToken) {
    await logAdminAction({
      action: "login",
      adminEmail: email,
      ip,
      userAgent,
      success: false,
      details: { reason: "invalid_2fa_token" },
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
  }

  // Destroy any existing session (session rotation)
  await destroyAdminSession();

  // Reset rate limit on successful login
  await resetRateLimit(ip);

  // Update last login time
  await updateAdminLastLogin(user.id);

  // Create new session with user info
  await createAdminSession(user.id, user.email, user.role);

  // Log successful login
  await logAdminAction({
    action: "login",
    adminEmail: user.email,
    ip,
    userAgent,
    success: true,
    details: { role: user.role },
  });

  const res = NextResponse.json({ redirect: next });
  return res;
}