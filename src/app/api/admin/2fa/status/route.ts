import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { isTwoFactorEnabled } from "@/lib/twoFactor";

export const runtime = "nodejs";

export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isTwoFactorEnabled();

  return NextResponse.json({ enabled });
}
