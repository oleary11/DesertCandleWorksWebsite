import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import sharp from "sharp";

export const runtime = "nodejs";

type RequestBody = {
  productSlug?: string; // Optional: sync specific product, or all if omitted
};

/**
 * Sync product details (name, description, images) to existing Square catalog items.
 * Does NOT recreate products or touch variant mappings/inventory.
 * POST /api/admin/sync-square-details
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
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });

    const body: RequestBody = await req.json();
    const { productSlug } = body;

    const allProducts = await listResolvedProducts();
    const productsToSync = productSlug
      ? allProducts.filter((p) => p.slug === productSlug)
      : allProducts.filter((p) => p.squareCatalogId);

    if (productsToSync.length === 0) {
      return NextResponse.json({
        error: productSlug
          ? `Product ${productSlug} not found or not connected to Square`
          : "No products connected to Square",
      }, { status: 404 });
    }

    const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
    const baseUrl = environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const product of productsToSync) {
      try {
        console.log(`[Sync Square Details] Processing ${product.slug} (${product.squareCatalogId})`);

        // Fetch the current Square catalog item to get its version (required for updates)
        const fetchRes = await client.catalog.object.get({
          objectId: product.squareCatalogId!,
          includeRelatedObjects: false,
        });

        if (!fetchRes.object || fetchRes.object.type !== "ITEM") {
          throw new Error("Square catalog item not found or wrong type");
        }

        const existingItem = fetchRes.object;
        const currentVersion = existingItem.version;

        // Update name and description via batchUpsert (preserves existing variations)
        const idempotencyKey = `sync-details-${product.slug}-${Date.now()}`;
        await client.catalog.batchUpsert({
          idempotencyKey,
          batches: [{
            objects: [{
              type: "ITEM",
              id: product.squareCatalogId!,
              version: currentVersion,
              itemData: {
                name: product.name,
                description: product.seoDescription || undefined,
                // Preserve existing variations by not including them here
                // Square merges itemData fields; omitting variations keeps them
              },
            }],
          }],
        });

        console.log(`[Sync Square Details] ${product.slug}: Updated name/description`);

        // Now upload new images. Build the image list from images array or fall back to single image.
        const imageUrls: string[] = product.images?.length
          ? product.images
          : product.image ? [product.image] : [];

        let imagesUploaded = 0;
        for (let i = 0; i < Math.min(imageUrls.length, 5); i++) {
          const imageUrl = imageUrls[i];

          if (imageUrl.includes("localhost") || imageUrl.includes("127.0.0.1")) {
            console.warn(`[Sync Square Details] Skipping localhost image: ${imageUrl}`);
            continue;
          }

          try {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);

            const imageBuffer = await imageResponse.arrayBuffer();
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

            let imageBlob: Blob;
            let fileName: string;

            if (contentType === "image/webp") {
              const converted = await sharp(Buffer.from(imageBuffer))
                .jpeg({ quality: 85, mozjpeg: true })
                .toBuffer();
              imageBlob = new Blob([new Uint8Array(converted)], { type: "image/jpeg" });
              fileName = `image-${i}.jpg`;
            } else if (contentType === "image/png" || contentType === "image/x-png") {
              imageBlob = new Blob([imageBuffer], { type: "image/png" });
              fileName = `image-${i}.png`;
            } else {
              imageBlob = new Blob([imageBuffer], { type: "image/jpeg" });
              fileName = `image-${i}.jpg`;
            }

            const formData = new FormData();
            const request = {
              idempotency_key: `${idempotencyKey}-img-${i}`,
              object_id: product.squareCatalogId,
              image: {
                type: "IMAGE",
                id: `#temp_image_${i}`,
                image_data: {
                  caption: i === 0 ? product.name : `${product.name} - Image ${i + 1}`,
                },
              },
            };
            formData.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
            formData.append("image_file", imageBlob, fileName);

            const uploadRes = await fetch(`${baseUrl}/v2/catalog/images`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Square-Version": "2024-12-18",
              },
              body: formData,
            });

            const uploadResult = await uploadRes.json() as { image?: { id?: string }; errors?: unknown[] };
            if (uploadRes.ok && uploadResult.image?.id) {
              imagesUploaded++;
              console.log(`[Sync Square Details] ${product.slug}: Uploaded image ${i} -> ${uploadResult.image.id}`);
            } else {
              console.error(`[Sync Square Details] ${product.slug}: Image ${i} upload failed:`, uploadResult.errors);
            }
          } catch (imgErr) {
            console.error(`[Sync Square Details] ${product.slug}: Image ${i} error:`, imgErr);
          }
        }

        results.push({
          productSlug: product.slug,
          productName: product.name,
          success: true,
          imagesUploaded,
          totalImages: imageUrls.length,
        });
        successCount++;
      } catch (err) {
        console.error(`[Sync Square Details] Error for ${product.slug}:`, err);
        results.push({
          productSlug: product.slug,
          productName: product.name,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced details for ${successCount} products, ${errorCount} errors`,
      successCount,
      errorCount,
      results,
    });
  } catch (error) {
    console.error("[Sync Square Details] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Square details" },
      { status: 500 }
    );
  }
}
