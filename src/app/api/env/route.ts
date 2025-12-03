export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";

/**
 * Environment debugging endpoint - ADMIN ONLY
 * WARNING: This endpoint exposes sensitive server configuration
 * and should ONLY be accessible to authenticated admins.
 */
export async function GET() {
  // SECURITY: Require admin authentication
  const isAuthed = await isAdminAuthed();
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    cwd: process.cwd(),
    hasLocal: !!process.env.NEXT_PUBLIC_BASE_URL,
    stripeLen: process.env.STRIPE_SECRET_KEY?.length ?? null,
    keysWithStripe: Object.keys(process.env).filter(k => k.includes("STRIPE")),
  });
}