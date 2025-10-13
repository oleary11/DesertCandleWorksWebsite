import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/productsStore";
import { getResolvedProduct } from "@/lib/liveProducts";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const live = await getProductBySlug(slug);
  const resolved = await getResolvedProduct(slug);

  return NextResponse.json(
    { slug, live, resolved },
    { headers: { "Cache-Control": "no-store" } }
  );
}