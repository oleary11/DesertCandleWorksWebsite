import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { upsertProduct, type Product } from "@/lib/productsStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|1|yes|on)$/i.test(v.trim());
  if (typeof v === "number") return v === 1;
  return false;
}

export async function GET() {
  const items = await listResolvedProducts();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const data = (await req.json().catch(() => ({}))) as Partial<Product>;
  console.log("[API POST /api/admin/products] Received data:", JSON.stringify(data, null, 2));

  const required: (keyof Product)[] = ["slug", "name", "price", "sku"];
  for (const k of required) {
    if (data[k] == null || data[k] === "") {
      console.error(`[API POST /api/admin/products] Missing required field: ${k}`);
      return NextResponse.json({ error: `Missing ${k}` }, { status: 400 });
    }
  }

  const product: Product = {
    slug: String(data.slug),
    name: String(data.name),
    price: Number(data.price),
    image: data.image ? String(data.image) : undefined,
    images: data.images && Array.isArray(data.images) ? data.images : undefined,
    sku: String(data.sku),
    stripePriceId: data.stripePriceId ? String(data.stripePriceId) : undefined,
    seoDescription: data.seoDescription ? String(data.seoDescription) : `Hand-poured candle in an upcycled bottle.`,
    bestSeller: coerceBool(data.bestSeller),
    youngDumb: coerceBool(data.youngDumb),
    stock: Math.max(0, Number(data.stock ?? 0)),
    variantConfig: data.variantConfig,
    alcoholType: data.alcoholType ?? undefined,
  };

  await upsertProduct(product);

  // Revalidate cached pages (wrapped in try-catch for Turbopack compatibility)
  try {
    revalidatePath("/shop");
    revalidatePath(`/shop/${product.slug}`);
    revalidatePath("/");
  } catch (error) {
    console.warn("Cache revalidation failed (this is OK in dev mode):", error);
  }

  return NextResponse.json(
    { ok: true, product },
    { headers: { "Cache-Control": "no-store" } }
  );
}