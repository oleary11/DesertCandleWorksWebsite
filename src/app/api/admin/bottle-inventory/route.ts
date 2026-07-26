// app/api/admin/bottle-inventory/route.ts
import { NextResponse } from "next/server";
import {
  addBottleType,
  getAllBottleInventory,
  BOTTLE_INVENTORY_TAG,
} from "@/lib/bottleInventoryStore";
import { revalidateTag } from "next/cache";
import { logAdminAction } from "@/lib/adminLogs";

export async function GET() {
  const items = await getAllBottleInventory();
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    defaultPriceCents?: number;
  };
  const name = (body.name ?? "").trim();

  if (!name) {
    await logAdminAction({
      action: "bottle-inventory.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { reason: "missing_name" },
    });
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const created = await addBottleType(name, body.defaultPriceCents);

  await logAdminAction({
    action: "bottle-inventory.create",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: { id: created.id, name: created.name },
  });

  revalidateTag(BOTTLE_INVENTORY_TAG);
  return NextResponse.json(
    { ok: true, item: created },
    { headers: { "Cache-Control": "no-store" } }
  );
}
