// app/api/admin/alcohol-types/[id]/route.ts
import { NextResponse } from "next/server";
import {
  updateAlcoholType,
  deleteAlcoholType,
  ALCOHOL_TYPES_TAG,
} from "@/lib/alcoholTypesStore";
import { revalidateTag } from "next/cache";
import { logAdminAction } from "@/lib/adminLogs";
import { kv } from "@vercel/kv";
import type { AlcoholType } from "@/lib/alcoholTypesStore";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { id } = await params;
  const patch = (await req.json().catch(() => ({}))) as {
    name?: string; sortOrder?: number; archived?: boolean;
  };

  const existing = await kv.get<AlcoholType>(`alcohol-type:${id}`);
  if (!existing) {
    await logAdminAction({
      action: "alcohol-type.update",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { reason: "not_found", id },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Track changes
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (patch.name !== undefined && patch.name !== existing.name) {
    changes.name = { from: existing.name, to: patch.name };
  }
  if (patch.sortOrder !== undefined && patch.sortOrder !== existing.sortOrder) {
    changes.sortOrder = { from: existing.sortOrder, to: patch.sortOrder };
  }
  if (patch.archived !== undefined && patch.archived !== existing.archived) {
    changes.archived = { from: existing.archived, to: patch.archived };
  }

  const updated = await updateAlcoholType(id, patch);

  await logAdminAction({
    action: "alcohol-type.update",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: {
      id,
      name: updated?.name,
      changes,
    },
  });

  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json(
    { ok: true, type: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { id } = await params;
  const existing = await kv.get<AlcoholType>(`alcohol-type:${id}`);

  const ok = await deleteAlcoholType(id);
  if (!ok) {
    await logAdminAction({
      action: "alcohol-type.delete",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { reason: "not_found", id },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAdminAction({
    action: "alcohol-type.delete",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: {
      id,
      name: existing?.name || id,
    },
  });

  revalidateTag(ALCOHOL_TYPES_TAG);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}