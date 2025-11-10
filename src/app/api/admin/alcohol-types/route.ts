// app/api/admin/alcohol-types/route.ts
import { NextResponse } from "next/server";
import {
  addAlcoholType,
  getAlcoholTypes,
  getActiveAlcoholTypes,
  ALCOHOL_TYPES_TAG,
} from "@/lib/alcoholTypesStore";
import { revalidateTag } from "next/cache";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active");
  const types = activeOnly ? await getActiveAlcoholTypes() : await getAlcoholTypes();
  return NextResponse.json(
    { types },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; sortOrder?: number };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const created = await addAlcoholType(name, body.sortOrder);
  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json(
    { ok: true, type: created },
    { headers: { "Cache-Control": "no-store" } }
  );
}