import { NextRequest, NextResponse } from "next/server";
import { addUnsubscribe, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const runtime = "nodejs";

/**
 * POST /api/unsubscribe?e=&t=
 * Gmail/Yahoo one-click unsubscribe (List-Unsubscribe-Post), and the confirm button on
 * /unsubscribe. The token is an HMAC of the address, so nobody can unsubscribe others.
 */
export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("e") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }
  const fromPage = req.nextUrl.searchParams.get("via") === "page";
  await addUnsubscribe(email, fromPage ? "link" : "one-click");
  return NextResponse.json({ ok: true });
}
