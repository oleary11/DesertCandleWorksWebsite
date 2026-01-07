import { NextRequest, NextResponse } from "next/server";
import { getShippingRates, validateAddress, getProductWeight } from "@/lib/shipstation";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

/**
 * POST /api/admin/get-shipping-rates
 *
 * Gets shipping rates from ShipStation for test orders
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shippingAddress, products } = body;

    // Validate required fields
    if (!shippingAddress) {
      return NextResponse.json(
        { error: "Missing shippingAddress" },
        { status: 400 }
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "Must include at least one product" },
        { status: 400 }
      );
    }

    // Validate and normalize address
    const validatedAddress = await validateAddress({
      name: shippingAddress.name,
      line1: shippingAddress.line1,
      line2: shippingAddress.line2,
      city: shippingAddress.city,
      state: shippingAddress.state,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country || "US",
    });

    console.log(`[Admin] Address validated successfully`);

    // Get all products to calculate weights
    const allProducts = await listResolvedProducts();
    const productsBySku = new Map(allProducts.map(p => [p.sku, p]));

    // Calculate total weight (candles only)
    let totalCandleWeightOz = 0;
    for (const item of products) {
      const product = productsBySku.get(item.sku);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.sku}` },
          { status: 404 }
        );
      }

      const weightPerItem = getProductWeight(product, item.sizeName);
      const quantity = item.quantity || 1;
      totalCandleWeightOz += weightPerItem * quantity;
    }

    // Add packaging weight once per shipment
    const { PACKAGING_WEIGHT_OZ } = await import("@/lib/shipstation");
    const totalWeightOz = totalCandleWeightOz + PACKAGING_WEIGHT_OZ;

    console.log(`[Admin] Total weight: ${totalCandleWeightOz} oz candles + ${PACKAGING_WEIGHT_OZ} oz packaging = ${totalWeightOz} oz`);

    // Get warehouse address from environment
    const warehouseAddress = {
      name: process.env.SHIPSTATION_FROM_NAME || "Desert Candle Works",
      street1: process.env.SHIPSTATION_FROM_ADDRESS || "123 Main St",
      city: process.env.SHIPSTATION_FROM_CITY || "Scottsdale",
      state: process.env.SHIPSTATION_FROM_STATE || "AZ",
      postalCode: process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260",
      country: "US",
    };

    console.log(`[Admin] Warehouse address:`, JSON.stringify(warehouseAddress, null, 2));

    // Validate warehouse address has all required fields
    if (!warehouseAddress.postalCode || !warehouseAddress.state || !warehouseAddress.city) {
      return NextResponse.json(
        {
          error: "Warehouse address not configured. Please set SHIPSTATION_FROM_* environment variables.",
          missingVars: {
            postalCode: !process.env.SHIPSTATION_FROM_POSTAL_CODE ? "SHIPSTATION_FROM_POSTAL_CODE" : undefined,
            state: !process.env.SHIPSTATION_FROM_STATE ? "SHIPSTATION_FROM_STATE" : undefined,
            city: !process.env.SHIPSTATION_FROM_CITY ? "SHIPSTATION_FROM_CITY" : undefined,
            address: !process.env.SHIPSTATION_FROM_ADDRESS ? "SHIPSTATION_FROM_ADDRESS" : undefined,
          }
        },
        { status: 500 }
      );
    }

    // Get shipping rates
    const rates = await getShippingRates(
      warehouseAddress.postalCode,
      validatedAddress.postalCode,
      totalWeightOz,
      true, // residential
      validatedAddress.city,
      validatedAddress.state
    );

    console.log(`[Admin] Got ${rates.length} shipping rates`);

    return NextResponse.json({
      success: true,
      rates,
      validatedAddress,
    });
  } catch (error) {
    console.error("[Admin] Get shipping rates error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get shipping rates";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
