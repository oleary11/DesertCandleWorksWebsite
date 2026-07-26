// app/api/admin/bottle-image-fetch/route.ts
//
// Fetches a single admin-selected image (from the bottle image search results)
// server-side and re-hosts it on Vercel Blob, same processing pipeline as the
// generic /api/admin/upload route (validate real image content, convert to
// JPEG, cap width). Only ever fetches the ONE image an admin explicitly
// clicked — never a bulk/automated pull of search results.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import sharp from "sharp";

const MAX_DOWNLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ["jpeg", "jpg", "png", "webp", "gif"];
const MAX_WIDTH = 2000;
const JPEG_QUALITY = 85;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { imageUrl?: string };
    const imageUrl = body.imageUrl?.trim();

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }
    if (imageUrl.includes("localhost") || imageUrl.includes("127.0.0.1")) {
      return NextResponse.json({ error: "Cannot fetch a localhost image" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return NextResponse.json({ error: `Failed to fetch image (${imageRes.status})` }, { status: 400 });
    }

    const contentLength = Number(imageRes.headers.get("content-length") || 0);
    if (contentLength > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(arrayBuffer);

    let imageMetadata;
    try {
      imageMetadata = await sharp(buffer).metadata();
    } catch {
      return NextResponse.json({ error: "That URL didn't return a valid image" }, { status: 400 });
    }

    if (!imageMetadata.format || !ALLOWED_FORMATS.includes(imageMetadata.format)) {
      return NextResponse.json(
        { error: `Unsupported image format: ${imageMetadata.format || "unknown"}` },
        { status: 400 }
      );
    }

    let processedImage = sharp(buffer).rotate();
    if (imageMetadata.width && imageMetadata.width > MAX_WIDTH) {
      processedImage = processedImage.resize(MAX_WIDTH, null, { fit: "inside", withoutEnlargement: true });
    }

    const optimizedBuffer = await processedImage.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

    const filename = `bottles/${crypto.randomUUID()}.jpg`;
    const blob = await put(filename, optimizedBuffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    return NextResponse.json({ url: blob.url }, { status: 200 });
  } catch (error) {
    console.error("[Bottle Image Fetch] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch and host image", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
