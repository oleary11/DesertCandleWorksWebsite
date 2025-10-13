export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    hasLocal: !!process.env.NEXT_PUBLIC_BASE_URL,
    stripeLen: process.env.STRIPE_SECRET_KEY?.length ?? null,
    keysWithStripe: Object.keys(process.env).filter(k => k.includes("STRIPE")),
  });
}