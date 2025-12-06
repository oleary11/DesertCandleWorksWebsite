export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import sharp from "sharp";

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
// NOTE: HEIC support requires sharp with libheif (included in sharp 0.34+)
// HEIC works on Vercel (Linux) but may not work on Windows dev environment
const ALLOWED_FORMATS = ["jpeg", "jpg", "png", "webp", "gif", "heic", "heif"];
const MAX_WIDTH = 2000; // Max width for product images
const JPEG_QUALITY = 85; // Good balance between quality and file size

export async function POST(req: NextRequest) {
  try {
    console.log("[Upload] Starting file upload process");

    // middleware already ensures you're authed
    const form = await req.formData();
    const file = form.get("file");

    console.log("[Upload] File received:", {
      isFile: file instanceof File,
      fileName: file instanceof File ? file.name : "N/A",
      fileSize: file instanceof File ? file.size : "N/A",
      fileType: file instanceof File ? file.type : "N/A",
    });

    if (!(file instanceof File)) {
      console.error("[Upload] No file or invalid file in form data");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.error(`[Upload] File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Basic MIME type check (but we'll validate actual content below)
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error(`[Upload] Suspicious file type: ${file.type}`);
      // Continue anyway - we'll validate actual content below
      // Some valid images (like HEIC) may have incorrect MIME types
    }

    // Convert file to buffer for processing
    const buffer = Buffer.from(await file.arrayBuffer());

    // SECURITY: Validate actual image content (not just MIME type)
    // This prevents uploaded SVG with JS, PHP files disguised as images, etc.
    let imageMetadata;
    try {
      imageMetadata = await sharp(buffer).metadata();
      console.log("[Upload] Image validated:", {
        detectedFormat: imageMetadata.format,
        reportedMimeType: file.type,
        width: imageMetadata.width,
        height: imageMetadata.height,
      });
    } catch (error) {
      console.error("[Upload] Invalid image file - content validation failed:", error);
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

    // Validate the actual detected format (not just the MIME type)
    if (!imageMetadata.format || !ALLOWED_FORMATS.includes(imageMetadata.format)) {
      console.error(`[Upload] Unsupported image format detected: ${imageMetadata.format}`);
      return NextResponse.json(
        { error: `Unsupported image format: ${imageMetadata.format}. Please upload JPEG, PNG, WebP, GIF, or HEIC.` },
        { status: 400 }
      );
    }

    // OPTIMIZATION: Convert all images to JPG and compress
    // This saves storage space and improves load times
    let processedImage = sharp(buffer);

    // Resize if image is too large
    if (imageMetadata.width && imageMetadata.width > MAX_WIDTH) {
      console.log(`[Upload] Resizing image from ${imageMetadata.width}px to ${MAX_WIDTH}px`);
      processedImage = processedImage.resize(MAX_WIDTH, null, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to JPG with compression
    const optimizedBuffer = await processedImage
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const filename = `products/${crypto.randomUUID()}.jpg`;

    console.log(`[Upload] Uploading optimized JPG to Vercel Blob: ${filename}`, {
      originalSize: buffer.length,
      optimizedSize: optimizedBuffer.length,
      savings: `${(((buffer.length - optimizedBuffer.length) / buffer.length) * 100).toFixed(1)}%`,
    });

    // Upload to Vercel Blob as a public file
    const blob = await put(filename, optimizedBuffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    console.log("[Upload] Upload successful:", {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      contentDisposition: blob.contentDisposition,
    });

    // blob.url is a public, CDN-backed URL you can save to the product.image
    return NextResponse.json({ url: blob.url }, { status: 200 });
  } catch (error) {
    console.error("[Upload] Upload failed with error:", error);
    console.error("[Upload] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : "No stack trace",
    });

    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}