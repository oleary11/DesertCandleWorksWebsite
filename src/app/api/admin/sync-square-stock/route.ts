import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

type RequestBody = {
  productSlug?: string; // Optional: sync specific product, or all if omitted
};

/**
 * Sync website inventory to Square
 * POST /api/admin/sync-square-stock
 */
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Square not configured" }, { status: 500 });
  }

  try {
    const { SquareClient, SquareEnvironment, InventoryChangeType, InventoryState } = await import("square");
    const client = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });

    const body: RequestBody = await req.json();
    const { productSlug } = body;

    // Get products to sync
    const allProducts = await listResolvedProducts();
    const productsToSync = productSlug
      ? allProducts.filter((p) => p.slug === productSlug)
      : allProducts.filter((p) => p.squareCatalogId && p.squareVariantMapping);

    if (productsToSync.length === 0) {
      return NextResponse.json({
        error: productSlug
          ? `Product ${productSlug} not found or not connected to Square`
          : "No products connected to Square",
      }, { status: 404 });
    }

    console.log(`[Sync Square Stock] Syncing ${productsToSync.length} products`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const product of productsToSync) {
      if (!product.squareVariantMapping || !product.squareCatalogId) {
        results.push({
          productSlug: product.slug,
          success: false,
          error: "No Square mapping found",
        });
        errorCount++;
        continue;
      }

      try {
        // Build inventory changes for all variants
        const changes = [];

        if (product.variantConfig) {
          // Product has variants - sync each variant's stock
          for (const [websiteVariantId, squareVariationId] of Object.entries(product.squareVariantMapping)) {
            const variantStock = product.variantConfig.variantData[websiteVariantId]?.stock ?? 0;

            changes.push({
              type: InventoryChangeType.PhysicalCount,
              physicalCount: {
                catalogObjectId: squareVariationId,
                state: InventoryState.InStock,
                quantity: String(variantStock),
                occurredAt: new Date().toISOString(),
              },
            });
          }
        } else {
          // Single product - sync base stock
          // Get the first (and should be only) variation ID
          const variationId = Object.values(product.squareVariantMapping)[0];
          if (variationId) {
            changes.push({
              type: InventoryChangeType.PhysicalCount,
              physicalCount: {
                catalogObjectId: variationId,
                state: InventoryState.InStock,
                quantity: String(product.stock),
                occurredAt: new Date().toISOString(),
              },
            });
          }
        }

        if (changes.length === 0) {
          results.push({
            productSlug: product.slug,
            success: false,
            error: "No variations to sync",
          });
          errorCount++;
          continue;
        }

        // Submit inventory changes to Square
        const response = await client.inventory.batchCreateChanges({
          idempotencyKey: `sync-${product.slug}-${Date.now()}`,
          changes,
        });

        console.log(`[Sync Square Stock] Synced ${changes.length} variations for ${product.slug}`);

        results.push({
          productSlug: product.slug,
          success: true,
          variationsSynced: changes.length,
        });
        successCount++;
      } catch (error) {
        console.error(`[Sync Square Stock] Error syncing ${product.slug}:`, error);
        results.push({
          productSlug: product.slug,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount} products successfully, ${errorCount} errors`,
      successCount,
      errorCount,
      results,
    });
  } catch (error) {
    console.error("[Sync Square Stock] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync stock" },
      { status: 500 }
    );
  }
}
