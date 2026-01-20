export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";

/**
 * Environment debugging endpoint - ADMIN ONLY, DEVELOPMENT ONLY
 *
 * SECURITY: This endpoint is disabled in production to prevent information leakage.
 * It only provides non-sensitive configuration status for debugging purposes.
 */
export async function GET() {
  // SECURITY: Disable this endpoint entirely in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  // SECURITY: Require admin authentication even in development
  const isAuthed = await isAdminAuthed();
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only expose non-sensitive configuration status (boolean checks, no values)
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    configured: {
      baseUrl: !!process.env.NEXT_PUBLIC_BASE_URL,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
      database: !!process.env.DATABASE_URL,
      redis: !!process.env.KV_REST_API_URL,
      blob: !!process.env.BLOB_READ_WRITE_TOKEN,
      email: !!process.env.RESEND_API_KEY,
      shipstation: !!process.env.SHIPSTATION_API_KEY,
      square: !!process.env.SQUARE_ACCESS_TOKEN,
      tiktok: !!process.env.TIKTOK_SHOP_APP_KEY,
      cronSecret: !!process.env.CRON_SECRET,
    },
  });
}
