export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  upsertProduct,
  deleteProduct,
  incrStock,
  setStock,
  type Product,
} from "@/lib/productsStore";
import { getResolvedProduct } from "@/lib/liveProducts";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function GET(_: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const p = await getResolvedProduct(slug); 
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product: p }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const existing = await getResolvedProduct(slug);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch = await req.json().catch(() => ({}));
  const merged: Product = { ...existing, ...patch, slug }; 

  const rawBest = (merged as any).bestSeller;
  merged.bestSeller =
    typeof rawBest === "boolean"
      ? rawBest
      : typeof rawBest === "string"
      ? /^(true|1|yes|on)$/i.test(rawBest.trim())
      : typeof rawBest === "number"
      ? rawBest === 1
      : false;

  if (merged.price != null) merged.price = Number(merged.price);
  if (merged.stock != null) merged.stock = Math.max(0, Number(merged.stock));

  await upsertProduct(merged); 
  return NextResponse.json({ ok: true, product: merged }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  await deleteProduct(slug);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  const value = Number(url.searchParams.get("value") ?? "1");

  if (op === "incr") {
    const s = await incrStock(slug, Math.floor(value)); 
    return NextResponse.json({ stock: s }, { headers: { "Cache-Control": "no-store" } });
  }
  if (op === "decr") {
    const s = await incrStock(slug, -Math.floor(value)); 
    return NextResponse.json({ stock: s }, { headers: { "Cache-Control": "no-store" } });
  }
  if (op === "set") {
    const s = await setStock(slug, value); 
    return NextResponse.json({ stock: s }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "Invalid op" }, { status: 400 });
}