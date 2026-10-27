import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { createFrame, deleteFrame, listFrames } from "@/lib/emailFramesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — built-in and uploaded email frames. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ frames: await listFrames() });
}

/** POST — create a frame from uploaded artwork and colours. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const frame = await createFrame(await req.json());
    return NextResponse.json({ frame }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save frame" }, { status: 400 });
  }
}

/** DELETE ?id= — remove an uploaded frame. */
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await deleteFrame(req.nextUrl.searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete frame" }, { status: 400 });
  }
}
