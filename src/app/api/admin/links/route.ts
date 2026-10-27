import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { createLink, listLinks, salesBySource, setLinkArchived } from "@/lib/trackingLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=30 — tracking links with clicks/orders/revenue, and website sales by source. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  try {
    const [links, sources] = await Promise.all([listLinks(), salesBySource(days)]);
    return NextResponse.json({ links, sources, days });
  } catch (error) {
    console.error("[Links] list failed:", error);
    return NextResponse.json({ error: "Failed to load links" }, { status: 500 });
  }
}

/** POST — create a tracking link. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const link = await createLink(await req.json());
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create link" }, { status: 400 });
  }
}

/** PATCH { id, archived } — archive a link (it stops redirecting to its page) or restore it. */
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, archived } = (await req.json().catch(() => ({}))) as { id?: string; archived?: boolean };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await setLinkArchived(id, !!archived);
  return NextResponse.json({ ok: true });
}
