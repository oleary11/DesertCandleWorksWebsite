import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { setImageExcluded } from "@/lib/social/store";

export const runtime = "nodejs";

// POST /api/admin/social/photos  body: { url, enabled } — switches a product photo on or off for social
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.url !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "url and enabled are required" }, { status: 400 });
  }
  await setImageExcluded(body.url, !body.enabled);
  return NextResponse.json({ ok: true });
}
