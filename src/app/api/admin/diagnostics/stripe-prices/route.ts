import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import Stripe from "stripe";

export const runtime = "nodejs";

type PriceTestResult = {
  productName: string;
  productSlug: string;
  stripePriceId: string;
  websitePriceCents: number;
  isValid: boolean;
  error?: string;
  priceDetails?: {
    currency: string;
    unitAmount: number;
    active: boolean;
    mode: "test" | "live";
  };
};

/**
 * Admin-only endpoint to test all Stripe price IDs
 * GET /api/admin/diagnostics/stripe-prices
 */
export async function GET(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Determine if we're in test mode based on the key
  const isTestMode = key.startsWith("sk_test_");
  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });

  try {
    // Get all products
    const products = await listResolvedProducts();

    // Test each product's price ID
    const results: PriceTestResult[] = [];

    for (const product of products) {
      // Calculate website price in cents
      const websitePriceCents = Math.round(product.price * 100);

      if (!product.stripePriceId) {
        results.push({
          productName: product.name,
          productSlug: product.slug,
          stripePriceId: "MISSING",
          websitePriceCents,
          isValid: false,
          error: "No Stripe Price ID configured",
        });
        continue;
      }

      try {
        const price = await stripe.prices.retrieve(product.stripePriceId);
        results.push({
          productName: product.name,
          productSlug: product.slug,
          stripePriceId: product.stripePriceId,
          websitePriceCents,
          isValid: true,
          priceDetails: {
            currency: price.currency,
            unitAmount: price.unit_amount || 0,
            active: price.active,
            mode: isTestMode ? "test" : "live",
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          productName: product.name,
          productSlug: product.slug,
          stripePriceId: product.stripePriceId,
          websitePriceCents,
          isValid: false,
          error: errorMessage,
        });
      }
    }

    // Summary stats
    const validCount = results.filter(r => r.isValid).length;
    const invalidCount = results.filter(r => !r.isValid).length;
    const missingCount = results.filter(r => r.stripePriceId === "MISSING").length;

    return NextResponse.json({
      mode: isTestMode ? "test" : "live",
      summary: {
        total: results.length,
        valid: validCount,
        invalid: invalidCount,
        missing: missingCount,
      },
      results,
    });
  } catch (error) {
    console.error("[Stripe Diagnostics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Diagnostic check failed" },
      { status: 500 }
    );
  }
}
