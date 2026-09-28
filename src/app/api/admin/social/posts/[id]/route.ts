import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import {
  compactQueue,
  deleteSocialPost,
  getSocialPost,
  listQueue,
  nextQueueOrder,
  updateSocialPost,
} from "@/lib/social/store";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

// PATCH /api/admin/social/posts/[id]
// body: { hook?, caption?, hashtags? } edits copy; { action: "approve" | "reject" | "unqueue" | "up" | "down" } moves it
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const post = await getSocialPost(id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const copy: { hook?: string; caption?: string; hashtags?: string[] } = {};
  if (typeof body.hook === "string") copy.hook = body.hook.trim();
  if (typeof body.caption === "string") copy.caption = body.caption.trim();
  if (Array.isArray(body.hashtags)) {
    copy.hashtags = body.hashtags
      .map((h: unknown) => String(h).replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 30);
  }

  switch (body.action) {
    case "approve":
      if (post.status !== "pending_review" && post.status !== "failed") {
        return NextResponse.json({ error: `Can't approve a post that is ${post.status}` }, { status: 400 });
      }
      if (post.kind === "reel" ? !post.videoUrl : !post.slides.length) {
        return NextResponse.json({ error: "This post has no finished media to approve" }, { status: 400 });
      }
      await updateSocialPost(id, { ...copy, status: "approved", queueOrder: await nextQueueOrder(), error: null });
      break;
    case "reject":
      await updateSocialPost(id, { ...copy, status: "rejected", queueOrder: null });
      await compactQueue();
      break;
    case "unqueue":
      await updateSocialPost(id, { ...copy, status: "pending_review", queueOrder: null });
      await compactQueue();
      break;
    case "up":
    case "down": {
      const queue = await listQueue();
      const i = queue.findIndex((p) => p.id === id);
      const j = body.action === "up" ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < queue.length) {
        await Promise.all([
          updateSocialPost(queue[i].id, { queueOrder: j + 1 }),
          updateSocialPost(queue[j].id, { queueOrder: i + 1 }),
        ]);
      }
      break;
    }
    default:
      if (Object.keys(copy).length) await updateSocialPost(id, copy);
  }

  return NextResponse.json({ post: await getSocialPost(id) });
}

// DELETE /api/admin/social/posts/[id]
export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const post = await getSocialPost(id);
  if (post?.status === "publishing") {
    return NextResponse.json({ error: "Can't delete a post while it's publishing" }, { status: 400 });
  }
  await deleteSocialPost(id);
  await compactQueue();
  return NextResponse.json({ ok: true });
}
