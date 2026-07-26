// app/api/admin/bottle-inventory/sync/route.ts
// Re-runnable action: scan candle products and seed/link bottle inventory
// rows by name (see syncBottleInventoryFromCandles for the matching rule).
import { NextResponse } from "next/server";
import { syncBottleInventoryFromCandles, BOTTLE_INVENTORY_TAG } from "@/lib/bottleInventoryStore";
import { revalidateTag } from "next/cache";
import { logAdminAction } from "@/lib/adminLogs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const result = await syncBottleInventoryFromCandles();

  await logAdminAction({
    action: "bottle-inventory.sync-from-candles",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: {
      createdCount: result.created.length,
      linkedCount: result.linked.length,
      unmatchedCount: result.unmatched.length,
    },
  });

  revalidateTag(BOTTLE_INVENTORY_TAG);
  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "no-store" } }
  );
}
