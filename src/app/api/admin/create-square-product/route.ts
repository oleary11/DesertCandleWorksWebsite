import { NextRequest, NextResponse } from "next/server";
import type { CatalogObject } from "square";

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
      return NextResponse.json({ error: "Square not configured" }, { status: 500 });
    }

    const { SquareClient, SquareEnvironment } = await import("square");

    const client = new SquareClient({
      token: accessToken,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });

    const body: RequestBody = await req.json();
    const { name, price, description, sku, images, variantConfig, scents } = body;

    // Validate required fields
    if (!name || price === undefined || price <= 0) {
      return NextResponse.json({ error: "Name and valid price are required" }, { status: 400 });
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

    // Use safe temp IDs (Square batchUpsert supports #tempId references)
    const slug = name.replace(/[^a-zA-Z0-9]/g, "_");
    const itemTempId = `#item_${slug}`;

    // Build variations array
    const variations: CatalogObject[] = [];

    if (variantConfig && scents && scents.length > 0) {
      // Create a variation for each wick type × scent combination
      for (const wick of variantConfig.wickTypes) {
        for (const scent of scents) {
          const variantKey = `${wick.id}-${scent.id}`;
          const wickCode = wick.id === "wood" ? "WD" : "STD";
          const scentCode = scent.id.substring(0, 3).toUpperCase();
          const variantSku = sku ? `${sku}-${wickCode}-${scentCode}` : undefined;
          const variantName = `${wick.name} - ${scent.name}`;

          variations.push(
            {
              type: "ITEM_VARIATION",
              id: `#var_${slug}_${variantKey}`,
              itemVariationData: {
                itemId: itemTempId,
                name: variantName,
                pricingType: "FIXED_PRICING",
                priceMoney: {
                  amount: BigInt(priceInCents),
                  currency: "USD",
                },
                sku: variantSku,
              },
            } satisfies CatalogObject
          );
        }
      }
    } else {
      // No variants - create single "Regular" variation
      variations.push(
        {
          type: "ITEM_VARIATION",
          id: `#var_${slug}_regular`,
          itemVariationData: {
            itemId: itemTempId,
            name: "Regular",
            pricingType: "FIXED_PRICING",
            priceMoney: {
              amount: BigInt(priceInCents),
              currency: "USD",
            },
            sku: sku || undefined,
          },
        } satisfies CatalogObject
      );
    }

    console.log(`[Create Square Product] Creating ${variations.length} variations`);

    // Create the catalog objects with variations
    const catalogObjects: CatalogObject[] = [
      {
        type: "ITEM",
        id: itemTempId,
        itemData: {
          name,
          description: description || undefined,
          variations,
        },
      } satisfies CatalogObject,
    ];

    // If we have images, create IMAGE objects
    if (images && images.length > 0) {
      const imageIds: string[] = [];

      for (let i = 0; i < Math.min(images.length, 5); i++) {
        // Square allows max 5 images per item
        const imageUrl = images[i];
        const imageId = `#img_${slug}_${i}`;

        catalogObjects.push(
          {
            type: "IMAGE",
            id: imageId,
            imageData: {
              url: imageUrl,
              caption: i === 0 ? name : `${name} - Image ${i + 1}`,
            },
          } satisfies CatalogObject
        );

        imageIds.push(imageId);
      }

      // Link the first image to the item (narrow the union before accessing itemData)
      const itemObj = catalogObjects[0];
      if (itemObj.type === "ITEM" && itemObj.itemData && imageIds.length > 0) {
        itemObj.itemData.imageIds = [imageIds[0]];
      }
    }

    const response = await client.catalog.batchUpsert({
      idempotencyKey,
      batches: [
        {
          objects: catalogObjects,
        },
      ],
    });

    console.log("[Create Square Product] Response:", response);

    // Find the created item/objects
    const createdItem = response.objects?.find((obj: any) => obj.type === "ITEM");
    const createdVariations = response.objects?.filter((obj: any) => obj.type === "ITEM_VARIATION");
    const createdImages = response.objects?.filter((obj: any) => obj.type === "IMAGE");

    if (!createdItem?.id) {
      throw new Error("Failed to get catalog item ID from Square response");
    }

    console.log("[Create Square Product] Catalog item created:", createdItem.id);
    console.log(
      "[Create Square Product] Created variations:",
      createdVariations?.map((v: any) => v.id)
    );
    console.log(
      "[Create Square Product] Created images:",
      createdImages?.map((i: any) => i.id)
    );

    // Build variant mapping for response
    const variantMapping: Record<string, string> = {};
    if (variantConfig && scents && createdVariations) {
      let variationIndex = 0;

      // Note: Square may not guarantee order; this assumes response order matches request order.
      // If you want this to be bulletproof, we can map using SKU/name matching instead.
      for (const wick of variantConfig.wickTypes) {
        for (const scent of scents) {
          const variantKey = `${wick.id}-${scent.id}`;
          const squareVariationId = createdVariations[variationIndex]?.id;
          if (squareVariationId) {
            variantMapping[variantKey] = squareVariationId;
          }
          variationIndex++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      catalogItemId: createdItem.id,
      variationCount: createdVariations?.length || 0,
      variantMapping, // Maps website variantKey (e.g., "standard-vanilla") to Square variation ID
      imageCount: createdImages?.length || 0,
      price: priceInCents,
      message: `Square catalog item created successfully with ${
        createdVariations?.length || 0
      } variations and ${createdImages?.length || 0} images`,
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