import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type WickType = {
  id: string;
  name: string;
};

type VariantConfig = {
  wickTypes: WickType[];
  variantData: Record<string, { stock: number }>;
};

type Scent = {
  id: string;
  name: string;
};

type RequestBody = {
  name: string;
  price: number; // Price in dollars
  description?: string;
  sku?: string;
  images?: string[];
  variantConfig?: VariantConfig;
  scents?: Scent[]; // Global scents for this product
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
    type { CatalogObject } = await import("square");
    const client = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });

    const body: RequestBody = await req.json();
    const { name, price, description, sku, images, variantConfig, scents } = body;

    // Validate required fields
    if (!name || price === undefined || price <= 0) {
      return NextResponse.json(
        { error: "Name and valid price are required" },
        { status: 400 }
      );
    }

    // Convert price to cents
    const priceInCents = Math.round(price * 100);

    console.log("[Create Square Product] Creating catalog item:", {
      name,
      priceInCents,
      description,
      sku,
      hasVariants: !!variantConfig,
      imageCount: images?.length || 0,
    });

    // Create a catalog item in Square
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const itemId = `#${name.replace(/[^a-zA-Z0-9]/g, "_")}`;

    // Build variations array
    const variations = [];

    if (variantConfig && scents && scents.length > 0) {
      // Create a variation for each wick type × scent combination
      for (const wick of variantConfig.wickTypes) {
        for (const scent of scents) {
          const variantId = `${wick.id}-${scent.id}`;
          const wickCode = wick.id === "wood" ? "WD" : "STD";
          const scentCode = scent.id.substring(0, 3).toUpperCase();
          const variantSku = `${sku}-${wickCode}-${scentCode}`;
          const variantName = `${wick.name} - ${scent.name}`;

          variations.push({
            type: "ITEM_VARIATION",
            id: `#${itemId}_${variantId}`,
            itemVariationData: {
              itemId: itemId,
              name: variantName,
              pricingType: "FIXED_PRICING",
              priceMoney: {
                amount: BigInt(priceInCents),
                currency: "USD",
              },
              sku: variantSku,
            },
          });
        }
      }
    } else {
      // No variants - create single "Regular" variation
      variations.push({
        type: "ITEM_VARIATION",
        id: `#${itemId}_regular`,
        itemVariationData: {
          itemId: itemId,
          name: "Regular",
          pricingType: "FIXED_PRICING",
          priceMoney: {
            amount: BigInt(priceInCents),
            currency: "USD",
          },
          sku: sku || undefined,
        },
      });
    }

    console.log(`[Create Square Product] Creating ${variations.length} variations`);

    // Create the catalog object with variations
    const catalogObjects: CatalogObject[] = [{
      type: "ITEM",
      id: itemId,
      itemData: {
        name,
        description: description || undefined,
        variations,
      },
    }];

    // If we have images, create IMAGE objects
    if (images && images.length > 0) {
      for (let i = 0; i < Math.min(images.length, 5); i++) { // Square allows max 5 images per item
        const imageUrl = images[i];
        const imageId = `#${itemId}_image_${i}`;

        catalogObjects.push({
          type: "IMAGE",
          id: imageId,
          imageData: {
            url: imageUrl,
            caption: i === 0 ? name : `${name} - Image ${i + 1}`,
          },
        });

        // Link the first image to the item
        if (i === 0 && catalogObjects[0].itemData) {
          catalogObjects[0].itemData.imageIds = [imageId];
        }
      }
    }

    const response = await client.catalog.batchUpsert({
      idempotencyKey,
      batches: [{
        objects: catalogObjects,
      }],
    });

    console.log("[Create Square Product] Response:", response);

    // Find the created item
    const createdItem = response.objects?.find((obj) => obj.type === "ITEM");
    const createdVariations = response.objects?.filter((obj) => obj.type === "ITEM_VARIATION");
    const createdImages = response.objects?.filter((obj) => obj.type === "IMAGE");

    if (!createdItem?.id) {
      throw new Error("Failed to get catalog item ID from Square response");
    }

    console.log("[Create Square Product] Catalog item created:", createdItem.id);
    console.log("[Create Square Product] Created variations:", createdVariations?.map(v => v.id));
    console.log("[Create Square Product] Created images:", createdImages?.map(i => i.id));

    // Build variant mapping for response
    const variantMapping: Record<string, string> = {};
    if (variantConfig && scents && createdVariations) {
      let variationIndex = 0;
      for (const wick of variantConfig.wickTypes) {
        for (const scent of scents) {
          const variantId = `${wick.id}-${scent.id}`;
          const squareVariationId = createdVariations[variationIndex]?.id;
          if (squareVariationId) {
            variantMapping[variantId] = squareVariationId;
          }
          variationIndex++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      catalogItemId: createdItem.id,
      variationCount: createdVariations?.length || 0,
      variantMapping, // Maps website variantId (e.g., "standard-vanilla") to Square variation ID
      imageCount: createdImages?.length || 0,
      price: priceInCents,
      message: `Square catalog item created successfully with ${createdVariations?.length || 0} variations and ${createdImages?.length || 0} images`,
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
