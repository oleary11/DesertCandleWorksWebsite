import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listPromoProductOptions } from "@/lib/promoProducts";

export const runtime = "nodejs";

/** GET /api/admin/promo-products — products that can be featured in a promotion email. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ products: await listPromoProductOptions() });
}
