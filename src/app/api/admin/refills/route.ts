import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import {
  cancelRefill,
  listRefillRequests,
  markRefillBroken,
  markRefillDone,
  markRefillReceived,
} from "@/lib/refills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ refills: await listRefillRequests() });
}

/** PATCH { id, action: "received" | "broken" | "done" | "cancel", note? } */
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: string; note?: string };
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    if (body.action === "received") await markRefillReceived(body.id);
    else if (body.action === "broken") await markRefillBroken(body.id, body.note);
    else if (body.action === "done") await markRefillDone(body.id);
    else if (body.action === "cancel") await cancelRefill(body.id);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
