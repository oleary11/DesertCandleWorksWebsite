// app/api/admin/bottle-inventory/bulk/route.ts
import { NextResponse } from "next/server";
import { updateBottleTypesMany, BOTTLE_INVENTORY_TAG } from "@/lib/bottleInventoryStore";
import { revalidateTag } from "next/cache";
import { logAdminAction } from "@/lib/adminLogs";

export async function PATCH(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const body = (await req.json().catch(() => ({}))) as {
    updates?: Array<{
      id: string;
      name?: string;
      qtyUncut?: number;
      qtyCutUnpolished?: number;
      qtyCutPolished?: number;
      qtyCutPoured?: number;
      defaultPriceCents?: number | null;
      imageUrl?: string | null;
      alcoholType?: string | null;
      usableForHomeGoods?: boolean;
      archived?: boolean;
    }>;
  };
  const updates = body.updates ?? [];

  await updateBottleTypesMany(updates);

  await logAdminAction({
    action: "bottle-inventory.bulk-update",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: { count: updates.length, ids: updates.map((u) => u.id) },
  });

  revalidateTag(BOTTLE_INVENTORY_TAG);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
