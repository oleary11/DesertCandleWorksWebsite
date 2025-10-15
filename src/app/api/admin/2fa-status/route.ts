import { NextResponse } from "next/server";
import { isTwoFactorEnabled } from "@/lib/twoFactor";

export const runtime = "nodejs";

// GET /api/admin/2fa-status - Check if 2FA is enabled (no auth required for status check)
export async function GET() {
  const enabled = await isTwoFactorEnabled();

  return NextResponse.json({
    enabled,
    message: enabled
      ? "2FA is enabled. Use your authenticator app or backup code."
      : "2FA is not enabled."
  });
}
