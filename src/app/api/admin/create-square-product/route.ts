import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestBody = {
  name: string;
  price: number; // Price in dollars
  description?: string;
  sku?: string;
};

export async function POST(req: NextRequest) {
  try {
    // Middleware already checks admin auth
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "Square not configured" },
        { status: 500 }
      );
    }

    const { SquareClient, SquareEnvironment } = await import("square");
    const client = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });

    const body: RequestBody = await req.json();
    const { name, price, description, sku } = body;

    // Validate required fields
    if (!name || price === undefined || price <= 0) {
      return NextResponse.json(
        { error: "Name and valid price are required" },
        { status: 400 }
      );
    }

    // Convert price to cents
    const priceInCents = Math.round(price * 100);

    console.log("[Create Square Product] Creating catalog item:", { name, priceInCents, description, sku });

    // Create a catalog item in Square
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const response = await client.catalog.batchUpsert({
      idempotencyKey,
      batches: [{
        objects: [{
          type: "ITEM",
          id: `#${name.replace(/[^a-zA-Z0-9]/g, "_")}`,
          itemData: {
            name,
            description: description || undefined,
            variations: [{
              type: "ITEM_VARIATION",
              id: `#${name.replace(/[^a-zA-Z0-9]/g, "_")}_variation`,
              itemVariationData: {
                itemId: `#${name.replace(/[^a-zA-Z0-9]/g, "_")}`,
                name: "Regular",
                pricingType: "FIXED_PRICING",
                priceMoney: {
                  amount: BigInt(priceInCents),
                  currency: "USD",
                },
                sku: sku || undefined,
              },
            }],
          },
        }],
      }],
    });

    console.log("[Create Square Product] Response:", response);

    // Find the created item
    const createdItem = response.objects?.find((obj) => obj.type === "ITEM");
    const createdVariation = response.objects?.find((obj) => obj.type === "ITEM_VARIATION");

    if (!createdItem?.id) {
      throw new Error("Failed to get catalog item ID from Square response");
    }

    console.log("[Create Square Product] Catalog item created:", createdItem.id);

    return NextResponse.json({
      success: true,
      catalogItemId: createdItem.id,
      catalogVariationId: createdVariation?.id,
      price: priceInCents,
      message: "Square catalog item created successfully",
    });
  } catch (error) {
    console.error("[Create Square Product] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to create Square catalog item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
