import { NextRequest, NextResponse } from "next/server";
import { getShippingRates, getProductWeight } from "@/lib/shipstation";
import { getPriceToProduct } from "@/lib/pricemap";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

type ShippingRate = {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  totalCost: number;
  deliveryDays: number | null;
  deliveryDate: string | null;
};

/**
 * Filter shipping rates to show only 3 simple options
 * Strategy: Cheapest standard, cheapest 2-day, cheapest overnight
 * Based on REAL delivery_days from ShipStation, not service name guessing
 */
function filterRelevantRates(rates: ShippingRate[]): ShippingRate[] {
  if (rates.length === 0) {
    return [];
  }

  // Find the cheapest option in each category based on actual delivery days
  let cheapestStandard: ShippingRate | null = null;
  let cheapest2Day: ShippingRate | null = null;
  let cheapestOvernight: ShippingRate | null = null;

  for (const rate of rates) {
    // Categorize by actual delivery_days returned from ShipStation
    if (rate.deliveryDays !== null && rate.deliveryDays <= 1) {
      // Overnight (1 day or less)
      if (!cheapestOvernight || rate.totalCost < cheapestOvernight.totalCost) {
        cheapestOvernight = rate;
      }
    } else if (rate.deliveryDays === 2) {
      // 2-day service
      if (!cheapest2Day || rate.totalCost < cheapest2Day.totalCost) {
        cheapest2Day = rate;
      }
    } else {
      // Standard/Ground (3+ days or unknown)
      if (!cheapestStandard || rate.totalCost < cheapestStandard.totalCost) {
        cheapestStandard = rate;
      }
    }
  }

  // Build final list with only the options we found
  const finalRates: ShippingRate[] = [];

  if (cheapestStandard) finalRates.push(cheapestStandard);
  if (cheapest2Day) finalRates.push(cheapest2Day);
  if (cheapestOvernight) finalRates.push(cheapestOvernight);

  // Sort by price (cheapest first)
  return finalRates.sort((a, b) => a.totalCost - b.totalCost);
}

/**
 * POST /api/shipping/rates
 * Calculate shipping rates for a cart using ShipStation API
 *
 * Request body:
 * {
 *   lineItems: Array<{ price: string, quantity: number, metadata?: { sizeName?: string } }>,
 *   shippingAddress: {
 *     city: string,
 *     state: string,
 *     postalCode: string,
 *     country: string
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineItems, shippingAddress } = body;

    // Validate input
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "Line items are required" },
        { status: 400 }
      );
    }

    if (!shippingAddress || !shippingAddress.postalCode) {
      return NextResponse.json(
        { error: "ZIP code is required" },
        { status: 400 }
      );
    }

    // Get product data to calculate total weight
    const priceToProduct = await getPriceToProduct();
    const products = await listResolvedProducts();
    const productsBySlug = new Map(products.map(p => [p.slug, p]));

    let totalWeightOz = 0;

    for (const item of lineItems) {
      const productInfo = priceToProduct.get(item.price);
      if (!productInfo) {
        console.warn(`[Shipping] Unknown price ID: ${item.price}`);
        continue;
      }

      const product = productsBySlug.get(productInfo.slug);
      const quantity = item.quantity || 1;
      const sizeName = item.metadata?.sizeName;

      // Get weight for this product
      const weightPerItem = getProductWeight(product, sizeName);
      totalWeightOz += weightPerItem * quantity;
    }

    console.log(`[Shipping] Total cart weight: ${totalWeightOz} oz for ${lineItems.length} items`);

    // Get business postal code from environment (your warehouse/home location)
    const fromPostalCode = process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260"; // Scottsdale, AZ default

    // Get shipping rates from V2 API (will query all carriers)
    const allRates: ShippingRate[] = [];

    try {
      const rates = await getShippingRates(
        fromPostalCode,
        shippingAddress.postalCode,
        totalWeightOz,
        true, // residential
        shippingAddress.city,
        shippingAddress.state
      );

      // Add $2 for packing materials to each rate
      const PACKING_COST = 2.00;

      for (const rate of rates) {
        allRates.push({
          serviceName: rate.serviceName,
          serviceCode: rate.serviceCode,
          carrierCode: rate.carrierCode,
          shipmentCost: rate.shipmentCost,
          totalCost: rate.shipmentCost + PACKING_COST,
          deliveryDays: rate.deliveryDays ?? null,
          deliveryDate: rate.deliveryDate ?? null,
        });
      }
    } catch (error) {
      console.error(`[Shipping] Failed to get rates:`, error);
      return NextResponse.json(
        { error: "Failed to fetch shipping rates. Please try again." },
        { status: 500 }
      );
    }

    if (allRates.length === 0) {
      return NextResponse.json(
        { error: "No shipping rates available for this address" },
        { status: 404 }
      );
    }

    // Sort rates by total cost (cheapest first)
    allRates.sort((a, b) => a.totalCost - b.totalCost);

    console.log(`[Shipping] Found ${allRates.length} rates, cheapest: $${allRates[0].totalCost.toFixed(2)}`);

    // Filter to show only the most relevant options (not overwhelming)
    const filteredRates = filterRelevantRates(allRates);

    console.log(`[Shipping] Filtered to ${filteredRates.length} most relevant options`);

    return NextResponse.json({
      rates: filteredRates,
      totalWeightOz,
      packingCost: 2.00,
    });

  } catch (error) {
    console.error("[Shipping] Error calculating rates:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to calculate shipping rates",
      },
      { status: 500 }
    );
  }
}
