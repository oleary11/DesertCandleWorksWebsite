import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { disableTwoFactor } from "@/lib/twoFactor";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  await disableTwoFactor();

  await logAdminAction({
    action: "2fa_disabled",
    ip,
    userAgent,
    success: true,
  });

  return NextResponse.json({ success: true });
}
