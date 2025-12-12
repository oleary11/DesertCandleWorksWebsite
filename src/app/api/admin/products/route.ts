import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { upsertProduct, type Product } from "@/lib/productsStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { logAdminAction } from "@/lib/adminLogs";
import { getAdminSession } from "@/lib/adminSession";

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
  // Explicit auth check with session retrieval
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const data = (await req.json().catch(() => ({}))) as Partial<Product>;
  console.log("[API POST /api/admin/products] Received data:", JSON.stringify(data, null, 2));

  const required: (keyof Product)[] = ["slug", "name", "price", "sku"];
  for (const k of required) {
    if (data[k] == null || data[k] === "") {
      console.error(`[API POST /api/admin/products] Missing required field: ${k}`);

      await logAdminAction({
        action: "product.create",
        adminEmail: session.email,
        ip,
        userAgent,
        success: false,
        details: { reason: `missing_${k}`, slug: data.slug },
      });

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
    materialCost: data.materialCost !== undefined ? Number(data.materialCost) : undefined,
    visibleOnWebsite: data.visibleOnWebsite !== undefined ? coerceBool(data.visibleOnWebsite) : true,
  };

  await upsertProduct(product);

  // Log successful product creation
  await logAdminAction({
    action: "product.create",
    adminEmail: session.email,
    ip,
    userAgent,
    success: true,
    details: {
      slug: product.slug,
      name: product.name,
      price: product.price,
      sku: product.sku,
      alcoholType: product.alcoholType,
    },
  });

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