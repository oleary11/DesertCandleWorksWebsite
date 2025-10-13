import { NextResponse } from "next/server";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

export async function GET() {
  const all = await listResolvedProducts();
  const best = all.filter((p) => p.bestSeller === true);
  return NextResponse.json(
    {
      countAll: all.length,
      countBest: best.length,
      best: best.map((p) => ({ slug: p.slug, bestSeller: p.bestSeller, name: p.name })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}