import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, destroyAdminSession } from "@/lib/adminSession";
import { timingSafeEqual } from "crypto";
import { verifyTwoFactorToken, isTwoFactorEnabled } from "@/lib/twoFactor";
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
  let password = "";
  let twoFactorToken = "";
  let next = "/admin";

  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as {
      password?: string;
      twoFactorToken?: string;
      next?: string;
    };
    password = (body.password ?? "").toString();
    twoFactorToken = (body.twoFactorToken ?? "").toString();
    next = (body.next ?? "/admin").toString();
  } else {
    const form = await req.formData();
    password = (form.get("password") ?? "").toString();
    twoFactorToken = (form.get("twoFactorToken") ?? "").toString();
    next = (form.get("next") ?? "/admin").toString();
  }

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    await logAdminAction({
      action: "login",
      ip,
      userAgent,
      success: false,
      details: { reason: "server_config_error" },
    });

    return NextResponse.json(
      { error: "Admin password not configured on server" },
      { status: 500 }
    );
  }

  // Timing-safe comparison to prevent timing attacks
  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);

  // Pad to same length to prevent timing leaks
  const maxLength = Math.max(passwordBuffer.length, expectedBuffer.length);
  const paddedPassword = Buffer.alloc(maxLength);
  const paddedExpected = Buffer.alloc(maxLength);

  passwordBuffer.copy(paddedPassword);
  expectedBuffer.copy(paddedExpected);

  let isValid = false;
  try {
    isValid = timingSafeEqual(paddedPassword, paddedExpected) && password.length === expected.length;
  } catch {
    isValid = false;
  }

  if (!isValid) {
    await logAdminAction({
      action: "login",
      ip,
      userAgent,
      success: false,
      details: { reason: "invalid_password" },
    });

    // Add delay to slow down brute force
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Check if 2FA is enabled
  const twoFactorEnabled = await isTwoFactorEnabled();

  if (twoFactorEnabled) {
    if (!twoFactorToken) {
      // Password correct but need 2FA token
      return NextResponse.json({
        requiresTwoFactor: true,
        message: "Please enter your 2FA code",
      });
    }

    // Verify 2FA token
    const isValidToken = await verifyTwoFactorToken(twoFactorToken);
    if (!isValidToken) {
      await logAdminAction({
        action: "login",
        ip,
        userAgent,
        success: false,
        details: { reason: "invalid_2fa_token" },
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
    }
  }

  // Destroy any existing session (session rotation)
  await destroyAdminSession();

  // Reset rate limit on successful login
  await resetRateLimit(ip);

  // Create new session with UUID token in Redis
  await createAdminSession();

  // Log successful login
  await logAdminAction({
    action: "login",
    ip,
    userAgent,
    success: true,
    details: { twoFactorUsed: twoFactorEnabled },
  });

  const res = NextResponse.json({ redirect: next });
  return res;
}