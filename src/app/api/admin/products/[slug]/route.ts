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
import { logAdminAction } from "@/lib/adminLogs";

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
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { slug } = await ctx.params;
  const existing = await getResolvedProduct(slug);
  if (!existing) {
    await logAdminAction({
      action: "product.update",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { reason: "not_found", slug },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  // Track what changed
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  (Object.keys(patch) as (keyof Product)[]).forEach((key) => {
    if (key === "slug") return; // Skip slug since it's in the URL
    if (JSON.stringify(existing[key]) !== JSON.stringify(merged[key])) {
      changes[key] = { from: existing[key], to: merged[key] };
    }
  });

  await upsertProduct(merged);

  await logAdminAction({
    action: "product.update",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: {
      slug,
      name: merged.name,
      changes,
    },
  });

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

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { slug } = await ctx.params;
  const existing = await getResolvedProduct(slug);

  await deleteProduct(slug);

  await logAdminAction({
    action: "product.delete",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
    details: {
      slug,
      name: existing?.name || slug,
      sku: existing?.sku,
      alcoholType: existing?.alcoholType,
    },
  });

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
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  const value = Number(url.searchParams.get("value") ?? "1");

  if (op === "incr") {
    const product = await getResolvedProduct(slug);
    const oldStock = product?.stock || 0;
    const s = await incrStock(slug, Math.floor(value));

    await logAdminAction({
      action: "product.stock",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        slug,
        operation: "increment",
        value: Math.floor(value),
        oldStock,
        newStock: s,
      },
    });

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
    const product = await getResolvedProduct(slug);
    const oldStock = product?.stock || 0;
    const s = await incrStock(slug, -Math.floor(value));

    await logAdminAction({
      action: "product.stock",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        slug,
        operation: "decrement",
        value: Math.floor(value),
        oldStock,
        newStock: s,
      },
    });

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
    const product = await getResolvedProduct(slug);
    const oldStock = product?.stock || 0;
    const s = await setStock(slug, value);

    await logAdminAction({
      action: "product.stock",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        slug,
        operation: "set",
        oldStock,
        newStock: s,
      },
    });

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