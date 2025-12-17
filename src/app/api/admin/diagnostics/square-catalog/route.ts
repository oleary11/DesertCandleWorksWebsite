import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

type CatalogTestResult = {
  productName: string;
  productSlug: string;
  squareCatalogId: string;
  isValid: boolean;
  error?: string;
  catalogDetails?: {
    name: string;
    priceAmount?: number;
    priceCurrency?: string;
    active: boolean;
    mode: "sandbox" | "production";
  };
};

/**
 * Admin-only endpoint to test all Square catalog IDs
 * GET /api/admin/diagnostics/square-catalog
 */
export async function GET(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Square not configured" }, { status: 500 });
  }

  // Determine if we're in sandbox mode
  const isSandboxMode = process.env.SQUARE_ENVIRONMENT !== "production";

  try {
    const { SquareClient, SquareEnvironment } = await import("square");
    const client = new SquareClient({
      token: accessToken,
      environment: isSandboxMode
        ? SquareEnvironment.Sandbox
        : SquareEnvironment.Production,
    });

    // Get all products
    const products = await listResolvedProducts();

    // Test each product's catalog ID
    const results: CatalogTestResult[] = [];

    for (const product of products) {
      if (!product.squareCatalogId) {
        results.push({
          productName: product.name,
          productSlug: product.slug,
          squareCatalogId: "MISSING",
          isValid: false,
          error: "No Square Catalog ID configured",
        });
        continue;
      }

      try {
        const response = await client.catalog.object.retrieve({
          objectId: product.squareCatalogId,
          includeRelatedObjects: true,
        });

        const catalogObject = response.object;

        if (!catalogObject) {
          throw new Error("Catalog object not found");
        }

        // Extract price information from variations
        let priceAmount: number | undefined;
        let priceCurrency: string | undefined;

        if (response.relatedObjects) {
          const variation = response.relatedObjects.find(
            (obj) => obj.type === "ITEM_VARIATION"
          );
          if (variation && "itemVariationData" in variation && variation.itemVariationData?.priceMoney) {
            priceAmount = Number(variation.itemVariationData.priceMoney.amount);
            priceCurrency = variation.itemVariationData.priceMoney.currency;
          }
        }

        results.push({
          productName: product.name,
          productSlug: product.slug,
          squareCatalogId: product.squareCatalogId,
          isValid: true,
          catalogDetails: {
            name: "itemData" in catalogObject && catalogObject.itemData?.name
              ? catalogObject.itemData.name
              : "Unknown",
            priceAmount,
            priceCurrency,
            active: !catalogObject.isDeleted,
            mode: isSandboxMode ? "sandbox" : "production",
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          productName: product.name,
          productSlug: product.slug,
          squareCatalogId: product.squareCatalogId,
          isValid: false,
          error: errorMessage,
        });
      }
    }

    // Summary stats
    const validCount = results.filter((r) => r.isValid).length;
    const invalidCount = results.filter((r) => !r.isValid).length;
    const missingCount = results.filter((r) => r.squareCatalogId === "MISSING").length;

    return NextResponse.json({
      mode: isSandboxMode ? "sandbox" : "production",
      summary: {
        total: results.length,
        valid: validCount,
        invalid: invalidCount,
        missing: missingCount,
      },
      results,
    });
  } catch (error) {
    console.error("[Square Diagnostics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Diagnostic check failed" },
      { status: 500 }
    );
  }
}
