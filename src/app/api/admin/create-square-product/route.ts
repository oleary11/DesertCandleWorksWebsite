import { NextRequest, NextResponse } from "next/server";
import type { CatalogObject } from "square";
import sharp from "sharp";

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

// --- Type helpers to avoid `any` and properly narrow the Square union types ---
type CatalogItem = Extract<CatalogObject, { type: "ITEM" }>;
type CatalogVariation = Extract<CatalogObject, { type: "ITEM_VARIATION" }>;
type CatalogImage = Extract<CatalogObject, { type: "IMAGE" }>;

function isCatalogType<T extends CatalogObject["type"]>(type: T) {
  return (obj: CatalogObject): obj is Extract<CatalogObject, { type: T }> => obj.type === type;
}

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

    // NOTE: Images must be created AFTER the catalog item is created
    // We'll create them after the batchUpsert call

    const response = await client.catalog.batchUpsert({
      idempotencyKey,
      batches: [
        {
          objects: catalogObjects,
        },
      ],
    });

    console.log("[Create Square Product] Response:", response);

    const objects = response.objects ?? [];
    const idMappings = response.idMappings ?? [];

    // Find the created item/objects (no `any`)
    const createdItem: CatalogItem | undefined = objects.find(isCatalogType("ITEM"));
    const createdVariations: CatalogVariation[] = objects.filter(isCatalogType("ITEM_VARIATION"));
    const createdImages: CatalogImage[] = objects.filter(isCatalogType("IMAGE"));

    if (!createdItem?.id) {
      throw new Error("Failed to get catalog item ID from Square response");
    }

    console.log("[Create Square Product] Catalog item created:", createdItem.id);
    console.log("[Create Square Product] ID mappings:", idMappings);
    console.log(
      "[Create Square Product] Created variations from objects:",
      createdVariations.map((v) => v.id).filter(Boolean)
    );
    console.log(
      "[Create Square Product] Created images:",
      createdImages.map((i) => ({ id: i.id, url: i.imageData?.url }))
    );

    // Log any errors from Square about images
    if (response.errors && response.errors.length > 0) {
      console.error("[Create Square Product] Square returned errors:", JSON.stringify(response.errors, null, 2));
    }

    // Check if images were requested but none were created
    if (images && images.length > 0 && createdImages.length === 0) {
      console.error("[Create Square Product] WARNING: Images were provided but none were created by Square");
      console.error("[Create Square Product] Requested images:", images);
      console.error("[Create Square Product] Square response objects:", objects.map(o => ({ type: o.type, id: o.id })));
    }

    // Build variant mapping for response using idMappings
    // Square returns variations in idMappings, not in objects array
    const variantMapping: Record<string, string> = {};
    if (variantConfig && scents && idMappings.length > 0) {
      let variationIndex = 0;

      // Build the mapping using idMappings
      for (const wick of variantConfig.wickTypes) {
        for (const scent of scents) {
          const variantKey = `${wick.id}-${scent.id}`;
          const clientObjectId = `#var_${slug}_${variantKey}`;

          // Find the mapping for this client ID
          const mapping = idMappings.find(m => m.clientObjectId === clientObjectId);
          if (mapping?.objectId) {
            variantMapping[variantKey] = mapping.objectId;
            console.log(`[Create Square Product] Mapped ${variantKey} -> ${mapping.objectId}`);
          } else {
            console.warn(`[Create Square Product] No mapping found for ${clientObjectId}`);
          }

          variationIndex++;
        }
      }
    }

    console.log("[Create Square Product] Final variant mapping:", variantMapping);

    // Now upload images using Square's REST API directly
    // Note: The Square SDK doesn't fully support image uploads via the Node SDK,
    // so we use the REST API directly with multipart/form-data
    const createdImageIds: string[] = [];
    if (images && images.length > 0) {
      console.log("[Create Square Product] Uploading images to Square");

      const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
      const baseUrl = environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

      for (let i = 0; i < Math.min(images.length, 5); i++) {
        const imageUrl = images[i];

        console.log(`[Create Square Product] Processing image ${i}: ${imageUrl}`);

        // Validate that the URL is publicly accessible (not localhost)
        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
          console.warn(`[Create Square Product] Warning: Skipping localhost image: ${imageUrl}`);
          continue;
        }

        try {
          // Fetch the image from the URL
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

          let imageBlob: Blob;
          let fileName: string;

          // Convert WebP to JPEG using sharp (Square doesn't support WebP)
          if (contentType === 'image/webp') {
            console.log(`[Create Square Product] Converting WebP image ${i} to JPEG for Square compatibility`);
            try {
              const convertedBuffer = await sharp(Buffer.from(imageBuffer))
                .jpeg({ quality: 85, mozjpeg: true })
                .toBuffer();
              imageBlob = new Blob([new Uint8Array(convertedBuffer)], { type: 'image/jpeg' });
              fileName = `image-${i}.jpg`;
            } catch (conversionError) {
              console.error(`[Create Square Product] Failed to convert WebP image ${i}:`, conversionError);
              continue;
            }
          } else if (contentType === 'image/png' || contentType === 'image/x-png') {
            imageBlob = new Blob([imageBuffer], { type: 'image/png' });
            fileName = `image-${i}.png`;
          } else if (contentType === 'image/gif') {
            imageBlob = new Blob([imageBuffer], { type: 'image/gif' });
            fileName = `image-${i}.gif`;
          } else {
            // Default to JPEG
            imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
            fileName = `image-${i}.jpg`;
          }

          // Create form data with image file and metadata as separate parts
          const formData = new FormData();

          // Add the request metadata as a JSON part
          const request = {
            idempotency_key: `${idempotencyKey}-img-${i}`,
            object_id: createdItem.id,
            image: {
              type: "IMAGE",
              id: `#temp_image_${i}`,
              image_data: {
                caption: i === 0 ? name : `${name} - Image ${i + 1}`,
              },
            },
          };

          formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
          formData.append('image_file', imageBlob, fileName);

          // Upload to Square REST API
          const uploadResponse = await fetch(
            `${baseUrl}/v2/catalog/images`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Square-Version': '2024-12-18',
              },
              body: formData,
            }
          );

          const uploadResult = await uploadResponse.json();

          if (uploadResponse.ok && uploadResult.image?.id) {
            createdImageIds.push(uploadResult.image.id);
            console.log(`[Create Square Product] Uploaded image ${i}: ${uploadResult.image.id}`);
          } else {
            console.error(`[Create Square Product] Failed to upload image ${i}:`, uploadResult);
          }
        } catch (imageError) {
          console.error(`[Create Square Product] Failed to upload image ${i}:`, imageError);
          // Continue with other images even if one fails
        }
      }

      console.log(`[Create Square Product] Successfully uploaded ${createdImageIds.length} images`);
    }

    return NextResponse.json({
      success: true,
      catalogItemId: createdItem.id,
      variationCount: createdVariations.length,
      variantMapping, // Maps website variantKey (e.g., "standard-vanilla") to Square variation ID
      imageCount: createdImageIds.length,
      price: priceInCents,
      message: `Square catalog item created successfully with ${createdVariations.length} variations and ${createdImageIds.length} images`,
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