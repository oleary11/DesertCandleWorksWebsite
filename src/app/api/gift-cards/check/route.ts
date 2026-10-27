import { NextRequest, NextResponse } from "next/server";
import { findActiveGiftCard, giftCardLookupAllowed } from "@/lib/giftCards";

export const runtime = "nodejs";

/** POST { code }: the card's balance, for the cart. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (!(await giftCardLookupAllowed(ip))) {
    return NextResponse.json({ ok: false, error: "Too many tries. Please wait a while." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  const card = code ? await findActiveGiftCard(code) : null;
  if (!card) return NextResponse.json({ ok: false, error: "That gift card code wasn't found." }, { status: 404 });
  if (card.balanceCents <= 0) return NextResponse.json({ ok: false, error: "This gift card has been used up." }, { status: 400 });
  return NextResponse.json({ ok: true, code: card.code, balanceCents: card.balanceCents });
}
