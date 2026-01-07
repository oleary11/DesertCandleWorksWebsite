import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { upsertProduct } from "@/lib/productsStore";

export const runtime = "nodejs";

/**
 * Clear all Square catalog IDs and variant mappings from all products
 * POST /api/admin/clear-all-square-ids
 */
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all products
    const allProducts = await listResolvedProducts();
    console.log(`[Clear Square IDs] Processing ${allProducts.length} products`);

    let clearedCount = 0;
    let skippedCount = 0;

    for (const product of allProducts) {
      if (product.squareCatalogId || product.squareVariantMapping) {
        // Clear Square data
        await upsertProduct({
          ...product,
          squareCatalogId: undefined,
          squareVariantMapping: undefined,
        });
        console.log(`[Clear Square IDs] ${product.slug}: Cleared Square catalog ID ${product.squareCatalogId || 'none'}`);
        clearedCount++;
      } else {
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleared Square data from ${clearedCount} products (${skippedCount} had no Square data)`,
      clearedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("[Clear Square IDs] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear Square IDs" },
      { status: 500 }
    );
  }
}
