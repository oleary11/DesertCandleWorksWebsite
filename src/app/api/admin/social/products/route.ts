import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { productPhotos } from "@/lib/social/content";
import { listExcludedImages } from "@/lib/social/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/social/products — every product on the site with its photos and whether each is on for social
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, excluded] = await Promise.all([listResolvedProducts(), listExcludedImages()]);
  return NextResponse.json({
    products: products
      .filter((p) => p.visibleOnWebsite !== false)
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        photos: productPhotos(p).map((url) => ({ url, enabled: !excluded.has(url) })),
      }))
      .filter((p) => p.photos.length > 0),
  });
}
