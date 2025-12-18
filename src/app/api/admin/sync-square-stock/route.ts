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
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken) {
    return NextResponse.json({ error: "Square not configured" }, { status: 500 });
  }

  if (!locationId) {
    return NextResponse.json({ error: "Square location ID not configured. Please set SQUARE_LOCATION_ID in your environment variables." }, { status: 500 });
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
      console.log(`[Sync Square Stock] Processing ${product.slug}:`, {
        hasSquareCatalogId: !!product.squareCatalogId,
        hasSquareVariantMapping: !!product.squareVariantMapping,
        mappingKeys: product.squareVariantMapping ? Object.keys(product.squareVariantMapping).length : 0,
        hasVariantConfig: !!product.variantConfig,
      });

      if (!product.squareVariantMapping || !product.squareCatalogId) {
        const error = !product.squareCatalogId
          ? "Missing squareCatalogId"
          : "Missing squareVariantMapping";
        console.error(`[Sync Square Stock] ${product.slug}: ${error}`);
        results.push({
          productSlug: product.slug,
          success: false,
          error,
        });
        errorCount++;
        continue;
      }

      try {
        // Build inventory changes for all variants
        const changes = [];

        if (product.variantConfig) {
          // Product has variants - sync each variant's stock
          console.log(`[Sync Square Stock] ${product.slug}: Has variantConfig with ${Object.keys(product.variantConfig.variantData).length} variants`);

          for (const [websiteVariantId, squareVariationId] of Object.entries(product.squareVariantMapping)) {
            const variantStock = product.variantConfig.variantData[websiteVariantId]?.stock ?? 0;

            console.log(`[Sync Square Stock] ${product.slug}: Variant ${websiteVariantId} -> Square ${squareVariationId} (stock: ${variantStock})`);

            changes.push({
              type: InventoryChangeType.PhysicalCount,
              physicalCount: {
                catalogObjectId: squareVariationId,
                locationId: locationId,
                state: InventoryState.InStock,
                quantity: String(variantStock),
                occurredAt: new Date().toISOString(),
              },
            });
          }
        } else {
          // Single product - sync base stock
          console.log(`[Sync Square Stock] ${product.slug}: No variantConfig, using base stock (${product.stock})`);

          // Get the first (and should be only) variation ID
          const variationId = Object.values(product.squareVariantMapping)[0];
          if (variationId) {
            console.log(`[Sync Square Stock] ${product.slug}: Using variation ID ${variationId}`);
            changes.push({
              type: InventoryChangeType.PhysicalCount,
              physicalCount: {
                catalogObjectId: variationId,
                locationId: locationId,
                state: InventoryState.InStock,
                quantity: String(product.stock),
                occurredAt: new Date().toISOString(),
              },
            });
          }
        }

        if (changes.length === 0) {
          console.error(`[Sync Square Stock] ${product.slug}: No variations to sync`);
          results.push({
            productSlug: product.slug,
            success: false,
            error: "No variations to sync",
          });
          errorCount++;
          continue;
        }

        console.log(`[Sync Square Stock] ${product.slug}: Submitting ${changes.length} inventory changes to Square`);

        // Submit inventory changes to Square
        const batchResult = await client.inventory.batchCreateChanges({
          idempotencyKey: `sync-${product.slug}-${Date.now()}`,
          changes,
        });

        console.log(`[Sync Square Stock] ${product.slug}: Square response:`, JSON.stringify(batchResult, null, 2));

        results.push({
          productSlug: product.slug,
          success: true,
          variationsSynced: changes.length,
        });
        successCount++;
      } catch (error) {
        console.error(`[Sync Square Stock] Error syncing ${product.slug}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Sync Square Stock] Error details:`, error);

        results.push({
          productSlug: product.slug,
          success: false,
          error: errorMessage,
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
