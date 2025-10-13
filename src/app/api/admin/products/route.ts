import { NextRequest, NextResponse } from "next/server";
import { upsertProduct, type Product } from "@/lib/productsStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export async function GET() {
  // ← merged view: live (Redis) + fallback static
  const items = await listResolvedProducts();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  // minimal validation
  const required = ["slug", "name", "price", "sku", "seoDescription"];
  for (const k of required) {
    if (!(k in data)) return NextResponse.json({ error: `Missing ${k}` }, { status: 400 });
  }
  const product = data as Product;
  product.price = Number(product.price);
  product.stock = Number(product.stock ?? 0);
  // bestSeller may come as string "true"/"false"
  if (typeof (product as any).bestSeller === "string") {
    product.bestSeller = (product as any).bestSeller === "true";
  }
  await upsertProduct(product);
  return NextResponse.json({ ok: true, product });
}