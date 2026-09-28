import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { advanceAllGenerating } from "@/lib/social/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/admin/social/advance — the admin page polls this while posts are generating.
// It's the fallback for fal webhooks, which can't reach local dev.
export async function POST() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await advanceAllGenerating();
  return NextResponse.json({ ok: true });
}
