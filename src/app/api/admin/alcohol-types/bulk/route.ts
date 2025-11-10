// app/api/admin/alcohol-types/bulk/route.ts
import { NextResponse } from "next/server";
import { updateAlcoholTypesMany, ALCOHOL_TYPES_TAG } from "@/lib/alcoholTypesStore";
import { revalidateTag } from "next/cache";

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    updates?: Array<{ id: string; name?: string; sortOrder?: number; archived?: boolean }>;
  };
  const updates = body.updates ?? [];
  await updateAlcoholTypesMany(updates);
  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}