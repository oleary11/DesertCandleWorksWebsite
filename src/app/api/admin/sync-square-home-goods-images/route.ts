import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAuthed } from "@/lib/adminSession";
import { getProductBySlug } from "@/lib/productsStore";
import { db } from "@/lib/db/client";
import { bottleInventory } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export const runtime = "nodejs";

type UploadResult = { image?: { id?: string }; errors?: unknown[] };

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: "Square not configured" }, { status: 500 });

  const { productSlug, offset = 0, limit = 5 } = await req.json() as {
    productSlug?: string;
    offset?: number;
    limit?: number;
  };
  if (!productSlug) return NextResponse.json({ error: "Missing productSlug" }, { status: 400 });

  const product = await getProductBySlug(productSlug);
  if (!product || product.productType !== "home_goods" || !product.squareCatalogId) {
    return NextResponse.json({ error: "Home Goods product is not connected to Square" }, { status: 404 });
  }

  const { SquareClient, SquareEnvironment } = await import("square");
  const client = new SquareClient({
    token: accessToken,
    environment: process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
  const baseUrl = process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
  const baseWebUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

  const fetched = await client.catalog.object.get({ objectId: product.squareCatalogId, includeRelatedObjects: false });
  if (!fetched.object || fetched.object.type !== "ITEM") {
    return NextResponse.json({ error: "Square item not found" }, { status: 404 });
  }
  const item = fetched.object;
  const variations = new Map(
    (item.itemData?.variations || []).map((variation) => [variation.id, variation]),
  );
  const mapping = product.squareVariantMapping || {};
  const bottleIds = (product.bottleOptions || []).map((option) => option.bottleId);
  const bottles = bottleIds.length
    ? await db.select({ id: bottleInventory.id, imageUrl: bottleInventory.imageUrl })
        .from(bottleInventory)
        .where(inArray(bottleInventory.id, bottleIds))
    : [];
  const imageByBottleId = new Map(bottles.map((bottle) => [bottle.id, bottle.imageUrl]));
  const jobs = (product.bottleOptions || [])
    .map((option) => ({
      option,
      variationId: mapping[option.bottleId],
      imageUrl: imageByBottleId.get(option.bottleId),
    }))
    .filter((job): job is typeof job & { variationId: string; imageUrl: string } => Boolean(job.variationId && job.imageUrl));

  async function uploadImage(imageUrl: string, objectId: string, caption: string, key: string) {
    const resolvedUrl = imageUrl.startsWith("/") ? `${baseWebUrl}${imageUrl}` : imageUrl;
    const imageResponse = await fetch(resolvedUrl);
    if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    const source = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    let imageBytes = new Uint8Array(source);
    let type = contentType;
    let fileName = "image.jpg";
    if (contentType === "image/webp") {
      imageBytes = new Uint8Array(await sharp(source).jpeg({ quality: 85, mozjpeg: true }).toBuffer());
      type = "image/jpeg";
    } else if (contentType.includes("png")) {
      type = "image/png";
      fileName = "image.png";
    }
    const formData = new FormData();
    formData.append("request", new Blob([JSON.stringify({
      idempotency_key: key,
      object_id: objectId,
      is_primary: true,
      image: { type: "IMAGE", id: "#image", image_data: { caption } },
    })], { type: "application/json" }));
    formData.append("image_file", new Blob([imageBytes], { type }), fileName);
    const response = await fetch(`${baseUrl}/v2/catalog/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2025-10-16" },
      body: formData,
    });
    const result = await response.json() as UploadResult;
    if (!response.ok || !result.image?.id) throw new Error(`Square image upload failed: ${JSON.stringify(result.errors || result)}`);
    return result.image.id;
  }

  let parentImageUpdated = false;
  if (offset === 0) {
    const oldParentImageIds = item.itemData?.imageIds || [];
    if (oldParentImageIds.length) await client.catalog.batchDelete({ objectIds: oldParentImageIds });
    const listingImage = product.images?.[0] || product.image;
    if (listingImage) {
      await uploadImage(listingImage, product.squareCatalogId, product.name, `hg-main-${product.slug}-${Date.now()}`);
      parentImageUpdated = true;
    }
  }

  let uploaded = 0;
  let skipped = 0;
  const errors: Array<{ bottleId: string; error: string }> = [];
  const chunk = jobs.slice(offset, offset + limit);
  for (const job of chunk) {
    try {
      const variation = variations.get(job.variationId);
      if (variation?.type === "ITEM_VARIATION" && variation.itemVariationData?.imageIds?.length) {
        skipped++;
        continue;
      }
      await uploadImage(
        job.imageUrl,
        job.variationId,
        job.option.bottleName,
        `hg-variation-${product.slug}-${job.option.bottleId}-${Date.now()}`,
      );
      uploaded++;
    } catch (error) {
      errors.push({ bottleId: job.option.bottleId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({
    total: jobs.length,
    processed: chunk.length,
    uploaded,
    skipped,
    failed: errors.length,
    parentImageUpdated,
    errors,
  });
}