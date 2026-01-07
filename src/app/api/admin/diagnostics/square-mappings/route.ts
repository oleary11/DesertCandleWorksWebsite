import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

type MappingDiagnostic = {
  productName: string;
  productSlug: string;
  squareCatalogId: string | undefined;
  hasVariantMapping: boolean;
  mappingCount: number;
  websiteVariantCount: number;
  status: "ready" | "missing_catalog_id" | "missing_mapping" | "partial_mapping";
};

/**
 * Diagnostic endpoint to check Square variant mapping status
 * GET /api/admin/diagnostics/square-mappings
 */
export async function GET(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all products
    const products = await listResolvedProducts();

    // Analyze each product's mapping status
    const results: MappingDiagnostic[] = [];

    for (const product of products) {
      const hasVariantMapping = !!(product.squareVariantMapping && Object.keys(product.squareVariantMapping).length > 0);
      const mappingCount = product.squareVariantMapping ? Object.keys(product.squareVariantMapping).length : 0;
      const websiteVariantCount = product.variantConfig
        ? Object.keys(product.variantConfig.variantData).length
        : 0;

      let status: MappingDiagnostic["status"];
      if (!product.squareCatalogId) {
        status = "missing_catalog_id";
      } else if (websiteVariantCount === 0) {
        // Simple product (no variants on website) - ready if it has catalog ID
        status = "ready";
      } else if (!hasVariantMapping) {
        // Variant product without any mapping
        status = "missing_mapping";
      } else if (mappingCount < websiteVariantCount) {
        // Variant product with incomplete mapping
        status = "partial_mapping";
      } else {
        // Variant product with complete mapping
        status = "ready";
      }

      results.push({
        productName: product.name,
        productSlug: product.slug,
        squareCatalogId: product.squareCatalogId,
        hasVariantMapping,
        mappingCount,
        websiteVariantCount,
        status,
      });
    }

    // Summary stats
    const summary = {
      total: results.length,
      ready: results.filter(r => r.status === "ready").length,
      missingCatalogId: results.filter(r => r.status === "missing_catalog_id").length,
      missingMapping: results.filter(r => r.status === "missing_mapping").length,
      partialMapping: results.filter(r => r.status === "partial_mapping").length,
    };

    // Group by status
    const byStatus = {
      ready: results.filter(r => r.status === "ready"),
      missingCatalogId: results.filter(r => r.status === "missing_catalog_id"),
      missingMapping: results.filter(r => r.status === "missing_mapping"),
      partialMapping: results.filter(r => r.status === "partial_mapping"),
    };

    return NextResponse.json({
      summary,
      byStatus,
      allResults: results,
    });
  } catch (error) {
    console.error("[Square Mapping Diagnostics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Diagnostic check failed" },
      { status: 500 }
    );
  }
}
