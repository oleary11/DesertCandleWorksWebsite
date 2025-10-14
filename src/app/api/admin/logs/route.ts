import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAdminLogs } from "@/lib/adminLogs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const logs = await getAdminLogs(Math.min(limit, 200)); // Max 200

  return NextResponse.json({ logs });
}
