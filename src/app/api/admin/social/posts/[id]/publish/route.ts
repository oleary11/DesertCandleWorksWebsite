import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { publishPost } from "@/lib/social/publish";

export const runtime = "nodejs";
export const maxDuration = 300; // Instagram can take a few minutes to process a reel

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/admin/social/posts/[id]/publish — post it now instead of waiting for its slot
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const post = await publishPost(id);
    return NextResponse.json({ post });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Publish failed" }, { status: 500 });
  }
}
