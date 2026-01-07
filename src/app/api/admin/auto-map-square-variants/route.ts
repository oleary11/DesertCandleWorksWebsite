import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { upsertProduct } from "@/lib/productsStore";

export const runtime = "nodejs";

type RequestBody = {
  productSlug?: string; // Optional: map specific product, or all if omitted
  dryRun?: boolean; // If true, only return what would be mapped without saving
};

/**
 * Auto-generate Square variant mappings by fetching variations from Square
 * and matching them to website variants
 * POST /api/admin/auto-map-square-variants
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
    const { SquareClient, SquareEnvironment } = await import("square");
    const client = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });

    const body: RequestBody = await req.json();
    const { productSlug, dryRun = false } = body;

    // Get products to map
    const allProducts = await listResolvedProducts();
    const productsToMap = productSlug
      ? allProducts.filter((p) => p.slug === productSlug)
      : allProducts.filter((p) => p.squareCatalogId);

    if (productsToMap.length === 0) {
      return NextResponse.json({
        error: productSlug
          ? `Product ${productSlug} not found or missing Square Catalog ID`
          : "No products with Square Catalog IDs found",
      }, { status: 404 });
    }

    console.log(`[Auto-Map Square Variants] Processing ${productsToMap.length} products (dryRun: ${dryRun})`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let recreatedCount = 0;

    for (const product of productsToMap) {
      try {
        if (!product.squareCatalogId) {
          console.log(`[Auto-Map] ${product.slug}: Skipping - no Square Catalog ID`);
          results.push({
            productSlug: product.slug,
            productName: product.name,
            success: false,
            skipped: true,
            reason: "No Square Catalog ID",
          });
          skippedCount++;
          continue;
        }

        // Check if product already has variant mapping
        if (product.squareVariantMapping && Object.keys(product.squareVariantMapping).length > 0) {
          console.log(`[Auto-Map] ${product.slug}: Skipping - already has variant mapping (${Object.keys(product.squareVariantMapping).length} mappings)`);
          results.push({
            productSlug: product.slug,
            productName: product.name,
            success: false,
            skipped: true,
            reason: "Already has variant mapping",
          });
          skippedCount++;
          continue;
        }

        // Fetch Square catalog item with variations
        console.log(`[Auto-Map] ${product.slug}: Fetching Square catalog item ${product.squareCatalogId}`);
        const response = await client.catalog.object.get({
          objectId: product.squareCatalogId,
          includeRelatedObjects: true,
        });

        if (!response.object) {
          throw new Error("Square catalog item not found");
        }

        // Extract variations (if any)
        const variations = response.relatedObjects?.filter(obj => obj.type === "ITEM_VARIATION") || [];

        if (variations.length === 0) {
          // Simple product without variations - need to recreate with proper variants
          console.log(`[Auto-Map] ${product.slug}: No variations in Square - recreating with variants`);

          // Check if product has variant config on website
          if (!product.variantConfig || !product.variantConfig.wickTypes || product.variantConfig.wickTypes.length === 0) {
            console.warn(`[Auto-Map] ${product.slug}: No variant config on website - cannot recreate`);
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

          // Get scents for this product
          const { getScentsForProduct } = await import("@/lib/scents");
          const productScents = await getScentsForProduct(product.slug);

          if (productScents.length === 0) {
            console.warn(`[Auto-Map] ${product.slug}: No scents available - cannot recreate`);
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

          console.log(`[Auto-Map] ${product.slug}: Found ${product.variantConfig.wickTypes.length} wick types and ${productScents.length} scents`);

          if (dryRun) {
            // In dry run mode, just report what would be recreated
            const expectedVariations = product.variantConfig.wickTypes.length * productScents.length;
            results.push({
              productSlug: product.slug,
              productName: product.name,
              success: false,
              skipped: true,
              reason: `Would recreate with ${expectedVariations} variations (${product.variantConfig.wickTypes.length} wicks × ${productScents.length} scents)`,
              dryRun: true,
            });
            skippedCount++;
            continue;
          }

          // Recreate the Square product with proper variations
          try {
            console.log(`[Auto-Map] ${product.slug}: Creating new Square product with variations`);

            // Determine price
            let price = 0;
            if (product.variantConfig.sizes && product.variantConfig.sizes.length > 0) {
              // Has sizes - use first size price
              price = product.variantConfig.sizes[0].priceCents / 100;
            } else if (product.price && product.price > 0) {
              // Use base price (already in dollars)
              price = product.price;
            } else {
              // Fallback to $44.99 (typical candle price)
              price = 44.99;
              console.warn(`[Auto-Map] ${product.slug}: No price found, using default $${price}`);
            }

            // Call create-square-product endpoint
            const createPayload = {
              name: product.name,
              price: price,
              description: product.description,
              sku: product.sku,
              images: product.images,
              variantConfig: product.variantConfig,
              scents: productScents,
            };

            console.log(`[Auto-Map] ${product.slug}: Creating with payload:`, JSON.stringify({
              name: createPayload.name,
              price: createPayload.price,
              sku: createPayload.sku,
              wickTypeCount: createPayload.variantConfig?.wickTypes?.length,
              scentCount: createPayload.scents?.length,
            }));

            const createRes = await fetch(`${req.nextUrl.origin}/api/admin/create-square-product`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cookie": req.headers.get("cookie") || "", // Pass auth cookie
              },
              body: JSON.stringify(createPayload),
            });

            if (!createRes.ok) {
              const errorData = await createRes.json();
              throw new Error(`Failed to create Square product: ${errorData.error || errorData.details || "Unknown error"}`);
            }

            const createData = await createRes.json();
            console.log(`[Auto-Map] ${product.slug}: Created new Square product ${createData.catalogItemId} with ${createData.variationCount} variations`);

            // Delete the old simple Square product
            const oldCatalogId = product.squareCatalogId;
            try {
              console.log(`[Auto-Map] ${product.slug}: Deleting old Square product ${oldCatalogId}`);
              await client.catalog.batchDelete({
                objectIds: [oldCatalogId],
              });
              console.log(`[Auto-Map] ${product.slug}: Successfully deleted old Square product`);
            } catch (deleteError) {
              console.warn(`[Auto-Map] ${product.slug}: Failed to delete old Square product ${oldCatalogId}:`, deleteError);
              // Don't fail the whole operation if delete fails - the new product is already created
            }

            // Update product with new catalog ID and variant mapping
            await upsertProduct({
              ...product,
              squareCatalogId: createData.catalogItemId,
              squareVariantMapping: createData.variantMapping,
            });

            console.log(`[Auto-Map] ${product.slug}: Updated product with new catalog ID and mappings`);

            results.push({
              productSlug: product.slug,
              productName: product.name,
              success: true,
              recreated: true,
              oldCatalogId: oldCatalogId,
              newCatalogId: createData.catalogItemId,
              variationCount: createData.variationCount,
              mapping: createData.variantMapping,
            });
            successCount++;
            recreatedCount++;
            continue;
          } catch (recreateError) {
            console.error(`[Auto-Map] ${product.slug}: Failed to recreate:`, recreateError);
            results.push({
              productSlug: product.slug,
              productName: product.name,
              success: false,
              error: `Failed to recreate: ${recreateError instanceof Error ? recreateError.message : String(recreateError)}`,
            });
            errorCount++;
            continue;
          }
        }

        console.log(`[Auto-Map] ${product.slug}: Found ${variations.length} Square variations`);

        // Build variant mapping
        const newMapping: Record<string, string> = {};

        if (product.variantConfig && Object.keys(product.variantConfig.variantData).length > 0) {
          // Product has variants on website - match by name/attributes
          console.log(`[Auto-Map] ${product.slug}: Has ${Object.keys(product.variantConfig.variantData).length} website variants`);

          // For variant products, we need to match Square variations to website variants
          // Square variation names typically include size, wick type, and scent
          // Website variant IDs are formatted as: [sizeId-]wickTypeId-scentId

          // Load scents for name matching
          const { getAllScents } = await import("@/lib/scents");
          const allScents = await getAllScents();

          for (const [websiteVariantId, variantData] of Object.entries(product.variantConfig.variantData)) {
            // Parse website variant ID to get components
            const knownWickTypes = ['standard-wick', 'wood-wick', 'wood', 'standard'];
            let sizeName: string | undefined;
            let wickTypeName: string | undefined;
            let scentName: string | undefined;

            // Find wick type in variant ID
            for (const wickTypeId of knownWickTypes) {
              if (websiteVariantId.includes(wickTypeId)) {
                const wickIndex = websiteVariantId.indexOf(wickTypeId);

                // Check for size prefix
                if (wickIndex > 0) {
                  const sizeId = websiteVariantId.substring(0, wickIndex - 1);
                  const size = product.variantConfig!.sizes?.find(s => s.id === sizeId);
                  sizeName = size?.name;
                }

                // Get wick type name
                const wickType = product.variantConfig!.wickTypes?.find(w => w.id === wickTypeId);
                wickTypeName = wickType?.name;

                // Get scent name
                const afterWick = websiteVariantId.substring(wickIndex + wickTypeId.length);
                const scentId = afterWick.startsWith('-') ? afterWick.substring(1) : afterWick;
                const scent = allScents.find(s => s.id === scentId);
                scentName = scent?.name;

                break;
              }
            }

            console.log(`[Auto-Map] ${product.slug}: Website variant ${websiteVariantId} = Size: ${sizeName}, Wick: ${wickTypeName}, Scent: ${scentName}`);

            // Try to find matching Square variation by name
            const matchingVariation = variations.find(v => {
              if (!("itemVariationData" in v) || !v.itemVariationData?.name) return false;

              const squareName = v.itemVariationData.name.toLowerCase();
              const components = [];
              if (sizeName) components.push(sizeName.toLowerCase());
              if (wickTypeName) components.push(wickTypeName.toLowerCase());
              if (scentName) components.push(scentName.toLowerCase());

              // Check if Square name contains all components
              return components.every(comp => squareName.includes(comp));
            });

            if (matchingVariation && matchingVariation.id) {
              console.log(`[Auto-Map] ${product.slug}: Matched ${websiteVariantId} -> ${matchingVariation.id}`);
              newMapping[websiteVariantId] = matchingVariation.id;
            } else {
              console.warn(`[Auto-Map] ${product.slug}: No Square variation found for ${websiteVariantId} (${sizeName} ${wickTypeName} ${scentName})`);
            }
          }
        } else {
          // Single product - map to first (and typically only) variation
          console.log(`[Auto-Map] ${product.slug}: No variants - using first Square variation`);
          if (variations[0]?.id) {
            newMapping["default"] = variations[0].id;
          }
        }

        if (Object.keys(newMapping).length === 0) {
          throw new Error("No variant mappings could be created");
        }

        console.log(`[Auto-Map] ${product.slug}: Created ${Object.keys(newMapping).length} mappings`);

        if (!dryRun) {
          // Save the mapping to the product
          await upsertProduct({
            ...product,
            squareVariantMapping: newMapping,
          });
          console.log(`[Auto-Map] ${product.slug}: Saved variant mapping to product`);
        }

        results.push({
          productSlug: product.slug,
          productName: product.name,
          success: true,
          squareVariations: variations.length,
          mappingsCreated: Object.keys(newMapping).length,
          mapping: newMapping,
          dryRun,
        });
        successCount++;
      } catch (error) {
        console.error(`[Auto-Map] Error mapping ${product.slug}:`, error);
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
      dryRun,
      message: dryRun
        ? `Would create mappings for ${successCount} products (${recreatedCount} recreated, ${skippedCount} skipped, ${errorCount} errors)`
        : `Created mappings for ${successCount} products (${recreatedCount} recreated, ${skippedCount} skipped, ${errorCount} errors)`,
      successCount,
      errorCount,
      skippedCount,
      recreatedCount,
      results,
    });
  } catch (error) {
    console.error("[Auto-Map Square Variants] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to auto-map variants" },
      { status: 500 }
    );
  }
}
