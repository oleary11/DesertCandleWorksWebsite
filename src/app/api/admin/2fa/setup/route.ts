import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { generateTwoFactorSecret, isTwoFactorEnabled } from "@/lib/twoFactor";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Check if 2FA is already enabled
  const isEnabled = await isTwoFactorEnabled();
  if (isEnabled) {
    return NextResponse.json(
      { error: "2FA is already enabled. Disable it first to re-setup." },
      { status: 400 }
    );
  }

  // Generate new secret and QR code
  const setup = await generateTwoFactorSecret();

  await logAdminAction({
    action: "2fa_setup_initiated",
    ip,
    userAgent,
    success: true,
  });

  return NextResponse.json({
    qrCodeUrl: setup.qrCodeUrl,
    backupCodes: setup.backupCodes,
    secret: setup.secret, // For manual entry
  });
}
