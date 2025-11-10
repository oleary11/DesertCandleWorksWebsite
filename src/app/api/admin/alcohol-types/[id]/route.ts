// app/api/admin/alcohol-types/[id]/route.ts
import { NextResponse } from "next/server";
import {
  updateAlcoholType,
  deleteAlcoholType,
  ALCOHOL_TYPES_TAG,
} from "@/lib/alcoholTypesStore";
import { revalidateTag } from "next/cache";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
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

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const ok = await deleteAlcoholType(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}