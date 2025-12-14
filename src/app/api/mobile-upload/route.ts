export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import sharp from "sharp";
import { getUploadSession, addUploadedImage } from "@/lib/mobileUpload";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/octet-stream", // HEIC files often detected as this
];
const ALLOWED_FORMATS = ["jpeg", "jpg", "png", "webp", "gif", "heic", "heif"];
const MAX_WIDTH = 2000; // Max width for product images
const JPEG_QUALITY = 85; // Good balance between quality and file size

export async function POST(req: NextRequest) {
  try {
    // Rate limiting protection against upload abuse
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const token = form.get("token");

    // Validate token
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Upload token is required" }, { status: 400 });
    }

    // Check if session exists and is valid
    const session = await getUploadSession(token);
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired upload session" }, { status: 401 });
    }

    if (session.completed) {
      return NextResponse.json({ error: "Upload session has been completed" }, { status: 400 });
    }

    // Validate file
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Basic MIME type check
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.warn(`[Mobile Upload] Suspicious file type: ${file.type}`);
    }

    // Convert file to buffer for processing
    const buffer = Buffer.from(await file.arrayBuffer());

    // SECURITY: Validate actual image content (not just MIME type)
    let imageMetadata;
    try {
      imageMetadata = await sharp(buffer).metadata();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Special message for HEIC on Windows dev environment
      if (file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif')) {
        return NextResponse.json(
          { error: `Unable to process HEIC file. ${errorMsg.includes('heif') ? 'HEIC support may not be available in your development environment. It will work in production.' : 'Please try converting to JPG first or the upload will work in production.'}` },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid image file. The file may be corrupted or not a valid image." },
        { status: 400 }
      );
    }

    // Validate the actual detected format
    if (!imageMetadata.format || !ALLOWED_FORMATS.includes(imageMetadata.format)) {
      return NextResponse.json(
        { error: `Unsupported image format: ${imageMetadata.format}. Please upload JPEG, PNG, WebP, GIF, or HEIC.` },
        { status: 400 }
      );
    }

    // OPTIMIZATION: Convert all images to JPG and compress
    let processedImage = sharp(buffer);

    // Resize if image is too large
    if (imageMetadata.width && imageMetadata.width > MAX_WIDTH) {
      processedImage = processedImage.resize(MAX_WIDTH, null, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to JPG with compression
    console.log("[Mobile Upload] Converting image to JPG...");
    const optimizedBuffer = await processedImage
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const filename = `products/${crypto.randomUUID()}.jpg`;

    console.log(`[Mobile Upload] Uploading optimized JPG to Vercel Blob: ${filename}`, {
      originalSize: buffer.length,
      optimizedSize: optimizedBuffer.length,
      token: token.substring(0, 8) + "...",
    });

    // Upload to Vercel Blob as a public file
    let blob;
    try {
      console.log("[Mobile Upload] Calling Vercel Blob put()...");
      blob = await put(filename, optimizedBuffer, {
        access: "public",
        contentType: "image/jpeg",
      });
      console.log("[Mobile Upload] Vercel Blob upload successful, URL:", blob.url);
    } catch (blobError) {
      console.error("[Mobile Upload] Vercel Blob upload error:", blobError);
      console.error("[Mobile Upload] Error name:", blobError instanceof Error ? blobError.name : "Unknown");
      console.error("[Mobile Upload] Error stack:", blobError instanceof Error ? blobError.stack : "No stack");
      return NextResponse.json(
        {
          error: "Failed to upload image to storage",
          details: blobError instanceof Error ? blobError.message : String(blobError),
        },
        { status: 500 }
      );
    }

    // Add the uploaded image URL to the session
    const added = await addUploadedImage(token, blob.url);
    if (!added) {
      return NextResponse.json(
        { error: "Failed to add image to session" },
        { status: 500 }
      );
    }

    console.log("[Mobile Upload] Upload successful:", {
      url: blob.url,
      sessionToken: token.substring(0, 8) + "...",
      totalImages: session.uploadedImages.length + 1,
    });

    return NextResponse.json({
      url: blob.url,
      totalImages: session.uploadedImages.length + 1
    }, { status: 200 });
  } catch (error) {
    console.error("[Mobile Upload] Upload failed:", error);
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
