export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

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

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error(`[Upload] Invalid file type: ${file.type}`);
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const original = file.name || "image.png";
    const ext = original.includes(".") ? original.split(".").pop()!.toLowerCase() : "png";
    const filename = `products/${crypto.randomUUID()}.${ext}`;

    console.log(`[Upload] Uploading to Vercel Blob: ${filename}`);

    // Upload to Vercel Blob as a public file
    const blob = await put(filename, file, { access: "public" });

    console.log("[Upload] Upload successful:", {
      url: blob.url,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
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