import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  upsertProduct,
  deleteProduct,
  incrStock,
  setStock,
  type Product,
} from "@/lib/productsStore";
import { getResolvedProduct } from "@/lib/liveProducts";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ slug: string }> };

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|1|yes|on)$/i.test(v.trim());
  if (typeof v === "number") return v === 1;
  return false;
}

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

  const patch = (await req.json().catch(() => ({}))) as Partial<Product>;
  const merged: Product = { ...existing, ...patch, slug };

  if ("bestSeller" in patch) {
    merged.bestSeller = coerceBool(patch.bestSeller);
  }
  if ("youngDumb" in patch) {
    merged.youngDumb = coerceBool(patch.youngDumb);
  }
  if ("price" in patch && merged.price != null) merged.price = Number(merged.price);
  if ("stock" in patch && merged.stock != null)
    merged.stock = Math.max(0, Number(merged.stock));

  await upsertProduct(merged);

  // Revalidate cached pages (wrapped in try-catch for Turbopack compatibility)
  try {
    revalidatePath("/shop");
    revalidatePath(`/shop/${slug}`);
    revalidatePath("/");
  } catch (error) {
    console.warn("Cache revalidation failed (this is OK in dev mode):", error);
  }

  return NextResponse.json(
    { ok: true, product: merged },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(_: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  await deleteProduct(slug);

  // Revalidate cached pages (wrapped in try-catch for Turbopack compatibility)
  try {
    revalidatePath("/shop");
    revalidatePath(`/shop/${slug}`);
    revalidatePath("/");
  } catch (error) {
    console.warn("Cache revalidation failed (this is OK in dev mode):", error);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

// Stock helpers via ?op=incr|decr|set&value=1
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  const value = Number(url.searchParams.get("value") ?? "1");

  if (op === "incr") {
    const s = await incrStock(slug, Math.floor(value));
    // Revalidate cached pages after stock change (wrapped in try-catch for Turbopack compatibility)
    try {
      revalidatePath("/shop");
      revalidatePath(`/shop/${slug}`);
      revalidatePath("/");
    } catch (error) {
      console.warn("Cache revalidation failed (this is OK in dev mode):", error);
    }
    return NextResponse.json({ stock: s }, { headers: { "Cache-Control": "no-store" } });
  }
  if (op === "decr") {
    const s = await incrStock(slug, -Math.floor(value));
    // Revalidate cached pages after stock change (wrapped in try-catch for Turbopack compatibility)
    try {
      revalidatePath("/shop");
      revalidatePath(`/shop/${slug}`);
      revalidatePath("/");
    } catch (error) {
      console.warn("Cache revalidation failed (this is OK in dev mode):", error);
    }
    return NextResponse.json({ stock: s }, { headers: { "Cache-Control": "no-store" } });
  }
  if (op === "set") {
    const s = await setStock(slug, value);
    // Revalidate cached pages after stock change (wrapped in try-catch for Turbopack compatibility)
    try {
      revalidatePath("/shop");
      revalidatePath(`/shop/${slug}`);
      revalidatePath("/");
    } catch (error) {
      console.warn("Cache revalidation failed (this is OK in dev mode):", error);
    }
    return NextResponse.json({ stock: s }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "Invalid op" }, { status: 400 });
}