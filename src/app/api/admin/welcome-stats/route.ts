import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { sql as dsql } from "drizzle-orm";
import { isAdminAuthed } from "@/lib/adminSession";
import { db } from "@/lib/db/client";
import { listPromotions } from "@/lib/promotionsStore";
import { isWelcomeCode } from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How the 10%-off welcome popup is doing: views, signups, codes used, and sales from them. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [shown, since, promotions] = await Promise.all([
      kv.get<number>("welcome:stats:shown").catch(() => 0),
      kv.get<string>("welcome:stats:since").catch(() => null),
      listPromotions(),
    ]);
    const codes = promotions.filter(isWelcomeCode);
    const used = codes.filter((p) => p.currentRedemptions > 0);
    const weekAgo = Date.now() - 7 * 86_400_000;
    let salesCents = 0;
    if (used.length) {
      const ids = used.map((p) => p.id);
      const result = await db.execute(dsql`
        SELECT coalesce(sum(total_cents), 0)::int AS cents FROM orders
        WHERE status <> 'cancelled' AND promotion_id IN (${dsql.join(ids.map((id) => dsql`${id}`), dsql`, `)})
      `);
      salesCents = Number((result.rows[0] as { cents: number } | undefined)?.cents ?? 0);
    }
    return NextResponse.json({
      shown: shown ?? 0,
      since,
      signups: codes.length,
      signupsThisWeek: codes.filter((p) => new Date(p.createdAt).getTime() >= weekAgo).length,
      used: used.length,
      salesCents,
      offerOn: process.env.WELCOME_OFFER_OFF !== "1",
    });
  } catch (error) {
    console.error("[Welcome stats] Failed:", error);
    return NextResponse.json({ error: "Couldn't load welcome popup results" }, { status: 500 });
  }
}
