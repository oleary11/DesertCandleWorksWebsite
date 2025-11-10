// app/api/admin/alcohol-types/[id]/route.ts
import { NextResponse } from "next/server";
import {
  updateAlcoholType,
  deleteAlcoholType,
  ALCOHOL_TYPES_TAG,
} from "@/lib/alcoholTypesStore";
import { revalidateTag } from "next/cache";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = (await req.json().catch(() => ({}))) as {
    name?: string; sortOrder?: number; archived?: boolean;
  };

  const updated = await updateAlcoholType(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json(
    { ok: true, type: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteAlcoholType(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}