import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { isFalConfigured } from "@/lib/social/fal";
import { createReel } from "@/lib/social/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/admin/social/reel  body: { productSlug, photoUrls: [url], notes? }
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFalConfigured()) return NextResponse.json({ error: "FAL_KEY is not configured" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const productSlug = typeof body.productSlug === "string" ? body.productSlug : "";
  const photoUrls = Array.isArray(body.photoUrls) ? body.photoUrls.filter((u: unknown) => typeof u === "string") : [];
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : undefined;

  if (!productSlug || !photoUrls.length) {
    return NextResponse.json({ error: "Pick a product and at least one photo" }, { status: 400 });
  }

  try {
    const post = await createReel(productSlug, photoUrls, notes);
    return NextResponse.json({ post });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reel failed" }, { status: 500 });
  }
}
