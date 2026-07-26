import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { upsertProduct } from "@/lib/productsStore";
import { getScentsForProduct } from "@/lib/scents";

export const runtime = "nodejs";

type RequestBody = {
  overwrite?: boolean; // If true, recreate even if Square catalog ID exists
};

/**
 * Create Square catalog items with variations for ALL products
 * POST /api/admin/create-all-square-products
 */
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: RequestBody = await req.json();
    const { overwrite = false } = body;

    // Get all products
    const allProducts = await listResolvedProducts();
    console.log(`[Create All Square Products] Processing ${allProducts.length} products (overwrite: ${overwrite})`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const product of allProducts) {
      try {
        // Skip if product already has Square catalog ID (unless overwrite is true)
        if (product.squareCatalogId && !overwrite) {
          console.log(`[Create All] ${product.slug}: Skipping - already has Square Catalog ID ${product.squareCatalogId}`);
          results.push({
            productSlug: product.slug,
            productName: product.name,
            success: false,
            skipped: true,
            reason: "Already has Square Catalog ID",
            existingCatalogId: product.squareCatalogId,
          });
          skippedCount++;
          continue;
        }

        const isHomeGoods = product.productType === "home_goods";

        // Check if product has enough configuration to build variations from
        if (isHomeGoods) {
          if (!product.bottleOptions || product.bottleOptions.length === 0) {
            console.warn(`[Create All] ${product.slug}: Skipping - Home Goods listing has no bottle options`);
            results.push({
              productSlug: product.slug,
              productName: product.name,
              success: false,
              skipped: true,
              reason: "No bottle options configured",
            });
            skippedCount++;
            continue;
          }
        } else if (!product.variantConfig || !product.variantConfig.wickTypes || product.variantConfig.wickTypes.length === 0) {
          console.warn(`[Create All] ${product.slug}: Skipping - no variant config (no wick types defined)`);
          results.push({
            productSlug: product.slug,
            productName: product.name,
            success: false,
            skipped: true,
            reason: "No variant config on website (no wick types defined)",
          });
          skippedCount++;
          continue;
        }

        // Get scents for this product (candles only)
        const productScents = isHomeGoods ? [] : await getScentsForProduct(product.slug);

        if (!isHomeGoods && productScents.length === 0) {
          console.warn(`[Create All] ${product.slug}: Skipping - no scents available`);
          results.push({
            productSlug: product.slug,
            productName: product.name,
            success: false,
            skipped: true,
            reason: "No scents available for this product",
          });
          skippedCount++;
          continue;
        }

        // Determine price
        let price = 0;
        if (isHomeGoods) {
          price = product.price;
        } else if (product.variantConfig!.sizes && product.variantConfig!.sizes.length > 0) {
          // Has sizes - use first size price
          price = product.variantConfig!.sizes[0].priceCents / 100;
        } else if (product.price && product.price > 0) {
          // Use base price (already in dollars)
          price = product.price;
        }

        if (!price || price <= 0) {
          console.error(`[Create All] ${product.slug}: No valid price found - cannot create`);
          results.push({
            productSlug: product.slug,
            productName: product.name,
            success: false,
            error: "No valid price found",
          });
          errorCount++;
          continue;
        }

        console.log(
          isHomeGoods
            ? `[Create All] ${product.slug}: Creating with ${product.bottleOptions!.length} bottle options`
            : `[Create All] ${product.slug}: Creating with ${product.variantConfig!.wickTypes.length} wick types × ${productScents.length} scents`
        );

        // Call create-square-product endpoint
        const createPayload = isHomeGoods
          ? {
              name: product.name,
              price: price,
              description: product.seoDescription,
              sku: product.sku,
              images: product.images,
              bottleOptions: product.bottleOptions,
            }
          : {
              name: product.name,
              price: price,
              description: product.seoDescription,
              sku: product.sku,
              images: product.images,
              variantConfig: product.variantConfig,
              scents: productScents,
            };

        console.log(`[Create All] ${product.slug}: Creating Square product with price $${price}`);

        const createRes = await fetch(`${req.nextUrl.origin}/api/admin/create-square-product`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
          },
          body: JSON.stringify(createPayload),
        });

        if (!createRes.ok) {
          const errorData = await createRes.json();
          throw new Error(`Failed to create Square product: ${errorData.error || errorData.details || "Unknown error"}`);
        }

        const createData = await createRes.json();
        console.log(`[Create All] ${product.slug}: Created Square product ${createData.catalogItemId} with ${createData.variationCount} variations`);

        // Update product with new catalog ID and variant mapping
        await upsertProduct({
          ...product,
          squareCatalogId: createData.catalogItemId,
          squareVariantMapping: createData.variantMapping,
        });

        console.log(`[Create All] ${product.slug}: Updated product in database`);

        results.push({
          productSlug: product.slug,
          productName: product.name,
          success: true,
          catalogItemId: createData.catalogItemId,
          variationCount: createData.variationCount,
          oldCatalogId: overwrite ? product.squareCatalogId : undefined,
        });
        successCount++;
      } catch (error) {
        console.error(`[Create All] ${product.slug}: Error:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
          productSlug: product.slug,
          productName: product.name,
          success: false,
          error: errorMessage,
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created Square products for ${successCount} products (${skippedCount} skipped, ${errorCount} errors)`,
      successCount,
      errorCount,
      skippedCount,
      results,
    });
  } catch (error) {
    console.error("[Create All Square Products] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Square products" },
      { status: 500 }
    );
  }
}
