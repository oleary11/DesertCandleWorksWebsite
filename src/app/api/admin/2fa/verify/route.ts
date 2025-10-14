import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { verifyTwoFactorToken } from "@/lib/twoFactor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const token = body.token || "";

  const isValid = await verifyTwoFactorToken(token);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
