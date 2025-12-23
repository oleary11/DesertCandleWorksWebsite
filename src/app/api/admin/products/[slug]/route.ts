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
import { getAdminSession } from "@/lib/adminSession";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ slug: string }> };

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|1|yes|on)$/i.test(v.trim());
  if (typeof v === "number") return v === 1;
  return false;
}

/**
 * Detect orphaned variants that don't match any current wick type
 * Returns array of orphaned variant IDs
 */
function detectOrphanedVariants(product: Product): string[] {
  if (!product.variantConfig) return [];

  const wickIds = new Set(product.variantConfig.wickTypes.map(w => w.id));
  const variantIds = Object.keys(product.variantConfig.variantData);

  return variantIds.filter((variantId) => {
    // Check if variant matches any wick type
    for (const wickId of wickIds) {
      if (variantId.startsWith(wickId + '-')) {
        return false; // Matches, not orphaned
      }
    }
    return true; // Doesn't match any wick, orphaned
  });
}

/**
 * Migrate variant IDs when wick type IDs change
 * This prevents orphaned variants that don't match any current wick type
 */
function migrateVariantIds(
  oldProduct: Product,
  newProduct: Product
): Product {
  // Only process if both have variant configs
  if (!oldProduct.variantConfig || !newProduct.variantConfig) {
    return newProduct;
  }

  const oldWickIds = new Set(oldProduct.variantConfig.wickTypes.map(w => w.id));
  const newWickIds = new Set(newProduct.variantConfig.wickTypes.map(w => w.id));

  // If wick IDs haven't changed, no migration needed
  if (
    oldWickIds.size === newWickIds.size &&
    Array.from(oldWickIds).every(id => newWickIds.has(id))
  ) {
    return newProduct;
  }

  // Build a mapping of old wick ID -> new wick ID
  const wickIdMap = new Map<string, string>();

  // Simple case: same number of wicks, just renamed
  const oldWickArray = oldProduct.variantConfig.wickTypes;
  const newWickArray = newProduct.variantConfig.wickTypes;

  if (oldWickArray.length === newWickArray.length) {
    // Map by position (assumes order is preserved)
    for (let i = 0; i < oldWickArray.length; i++) {
      if (oldWickArray[i].id !== newWickArray[i].id) {
        wickIdMap.set(oldWickArray[i].id, newWickArray[i].id);
      }
    }
  }

  // If no mapping found, don't migrate (complex scenario)
  if (wickIdMap.size === 0) {
    return newProduct;
  }

  // Migrate variant IDs
  const migratedVariantData: Record<string, { stock: number }> = {};

  for (const [variantId, data] of Object.entries(newProduct.variantConfig.variantData)) {
    let newVariantId = variantId;

    // Check if this variant uses an old wick ID
    for (const [oldWickId, newWickId] of wickIdMap.entries()) {
      if (variantId.startsWith(oldWickId + '-')) {
        // Migrate: replace old wick prefix with new wick prefix
        newVariantId = variantId.replace(oldWickId + '-', newWickId + '-');
        console.log(`[Variant Migration] ${variantId} → ${newVariantId}`);
        break;
      }
    }

    migratedVariantData[newVariantId] = data;
  }

  return {
    ...newProduct,
    variantConfig: {
      ...newProduct.variantConfig,
      variantData: migratedVariantData,
    },
  };
}

export async function GET(_: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const p = await getResolvedProduct(slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product: p }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  // Explicit auth check with session retrieval
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { slug } = await ctx.params;
  const existing = await getResolvedProduct(slug);
  if (!existing) {
    await logAdminAction({
      action: "product.update",
      adminEmail: session.email,
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

  // Migrate variant IDs if wick types changed
  const migrated = migrateVariantIds(existing, merged);

  // Check for orphaned variants after migration
  const orphanedVariants = detectOrphanedVariants(migrated);
  if (orphanedVariants.length > 0) {
    console.warn(`[Product Update] Warning: ${orphanedVariants.length} orphaned variants detected for ${slug}:`, orphanedVariants);
    console.warn('These variants will not be counted in stock calculations. Consider removing them.');
  }

  // Track what changed
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  (Object.keys(patch) as (keyof Product)[]).forEach((key) => {
    if (key === "slug") return; // Skip slug since it's in the URL
    if (JSON.stringify(existing[key]) !== JSON.stringify(migrated[key])) {
      changes[key] = { from: existing[key], to: migrated[key] };
    }
  });

  await upsertProduct(migrated);

  await logAdminAction({
    action: "product.update",
    adminEmail: session.email,
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
    { ok: true, product: migrated },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  // Explicit auth check with session retrieval
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { slug } = await ctx.params;
  const existing = await getResolvedProduct(slug);

  await deleteProduct(slug);

  await logAdminAction({
    action: "product.delete",
    adminEmail: session.email,
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
  // Explicit auth check with session retrieval
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      adminEmail: session.email,
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
      adminEmail: session.email,
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
      adminEmail: session.email,
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