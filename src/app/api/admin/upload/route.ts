export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  // middleware already ensures you're authed
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const original = file.name || "image.png";
  const ext = original.includes(".") ? original.split(".").pop()!.toLowerCase() : "png";
  const filename = `products/${crypto.randomUUID()}.${ext}`;

  // Upload to Vercel Blob as a public file
  const blob = await put(filename, file, { access: "public" });
  // blob.url is a public, CDN-backed URL you can save to the product.image
  return NextResponse.json({ url: blob.url }, { status: 200 });
}