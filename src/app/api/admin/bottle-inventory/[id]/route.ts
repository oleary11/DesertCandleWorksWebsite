// app/api/admin/bottle-inventory/[id]/route.ts
import { NextResponse } from "next/server";
import {
  updateBottleType,
  deleteBottleType,
  BOTTLE_INVENTORY_TAG,
} from "@/lib/bottleInventoryStore";
import { revalidateTag } from "next/cache";
import { logAdminAction } from "@/lib/adminLogs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { id } = await params;
  const patch = (await req.json().catch(() => ({}))) as {
    name?: string;
    qtyUncut?: number;
    qtyCutUnpolished?: number;
    qtyCutPolished?: number;
    capacityWaterOz?: number | null;
    defaultPriceCents?: number | null;
    imageUrl?: string | null;
    alcoholType?: string | null;
    usableForHomeGoods?: boolean;
    archived?: boolean;
  };

  const updated = await updateBottleType(id, patch);

  if (!updated) {
    await logAdminAction({
      action: "bottle-inventory.update",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { reason: "not_found", id },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAdminAction({
    action: "bottle-inventory.update",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: { id, name: updated.name, patch },
  });

  revalidateTag(BOTTLE_INVENTORY_TAG);
  return NextResponse.json(
    { ok: true, item: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { id } = await params;
  const ok = await deleteBottleType(id);

  if (!ok) {
    await logAdminAction({
      action: "bottle-inventory.delete",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { reason: "not_found", id },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAdminAction({
    action: "bottle-inventory.delete",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: { id },
  });

  revalidateTag(BOTTLE_INVENTORY_TAG);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
