import { NextRequest, NextResponse } from "next/server";
import { SOURCE_COOKIE, SOURCE_MAX_AGE, encodeSource } from "@/lib/attributionShared";
import { recordClick } from "@/lib/trackingLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ slug: string }> };

/**
 * GET /go/<slug> — a tracking link from admin. Counts the click, remembers the source
 * for 30 days (so the order gets credited), and forwards to the destination with utm
 * tags and the link's promo code (?promo=), which the cart applies automatically.
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const link = await recordClick(slug.toLowerCase()).catch((err) => {
    console.error("[Go] click failed:", err);
    return null;
  });

  const site = req.nextUrl.origin;
  if (!link) return NextResponse.redirect(new URL("/", site), 302);

  const to = new URL(link.destination || "/", site);
  to.searchParams.set("utm_source", link.source);
  if (link.medium) to.searchParams.set("utm_medium", link.medium);
  to.searchParams.set("utm_campaign", link.campaign || link.slug);
  if (link.promoCode) to.searchParams.set("promo", link.promoCode);

  const res = NextResponse.redirect(to, 302);
  res.headers.set("Cache-Control", "no-store"); // every click must reach us to be counted
  res.cookies.set(SOURCE_COOKIE, encodeSource({ source: link.source, medium: link.medium ?? undefined, campaign: link.campaign || link.slug, linkId: link.id, via: "link" }), {
    path: "/",
    maxAge: SOURCE_MAX_AGE,
    sameSite: "lax",
  });
  return res;
}
