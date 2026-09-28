import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { isFalConfigured } from "@/lib/social/fal";
import { isOpenAIConfigured } from "@/lib/social/content";
import { createBatch } from "@/lib/social/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/admin/social/generate  body: { collections, slideshows, memes }
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFalConfigured() || !isOpenAIConfigured()) {
    return NextResponse.json({ error: "FAL_KEY and OPENAI_API_KEY must both be configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const clamp = (v: unknown, max: number) => Math.min(Math.max(Math.round(Number(v) || 0), 0), max);
  const collections = clamp(body.collections, 12);
  const slideshows = clamp(body.slideshows, 12);
  const memes = clamp(body.memes, 6);
  if (!collections && !slideshows && !memes) return NextResponse.json({ error: "Nothing to generate" }, { status: 400 });

  try {
    const posts = await createBatch({ collections, slideshows, memes });
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generate failed" }, { status: 500 });
  }
}
