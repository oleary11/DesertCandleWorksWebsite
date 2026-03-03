import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

const LAYOUT_KEY = "admin:dashboard:layout";

export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const layout = await redis.get(LAYOUT_KEY);
  return NextResponse.json({ layout: layout ?? null });
}

export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { layout } = await req.json();
  if (
    !layout ||
    typeof layout !== "object" ||
    !Array.isArray(layout.large) ||
    !Array.isArray(layout.small)
  ) {
    return NextResponse.json({ error: "Invalid layout" }, { status: 400 });
  }

  await redis.set(LAYOUT_KEY, layout);
  return NextResponse.json({ success: true });
}
