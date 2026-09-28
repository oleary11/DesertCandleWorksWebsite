import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listQueue, listSocialPosts } from "@/lib/social/store";
import type { SocialStatus } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/social/posts?view=review|queue|history
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const view = req.nextUrl.searchParams.get("view") ?? "review";
  if (view === "queue") return NextResponse.json({ posts: await listQueue() });

  const statuses: SocialStatus[] =
    view === "history" ? ["published", "rejected"] : ["generating", "rendering", "pending_review", "failed", "publishing"];
  return NextResponse.json({ posts: await listSocialPosts(statuses, view === "history" ? 60 : 100) });
}
