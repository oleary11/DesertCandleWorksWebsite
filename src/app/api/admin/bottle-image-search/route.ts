// app/api/admin/bottle-image-search/route.ts
//
// Looks up candidate bottle photos via the Brave Search API (image search) so
// an admin can pick one to attach to a bottle inventory row. Deliberately does
// NOT scrape Google/Bing/Total Wine directly — that would violate their terms
// of service on top of the copyright question around whichever photo gets
// picked. Requires the admin's own Brave Search API key (BRAVE_SEARCH_API_KEY)
// — chosen over Google's Custom Search JSON API / Bing Search API because both
// of those are closed to new customers as of this writing.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Response shape per Brave's documented Image Search API. Not yet verified
// against a live key/response — if field names turn out to differ, adjust
// the mapping below (the frontend contract, {title, imageUrl, thumbnailUrl,
// sourceUrl}, doesn't need to change either way).
type BraveImageResult = {
  title?: string;
  url?: string;
  source?: string;
  thumbnail?: { src?: string };
  properties?: { url?: string };
};

type BraveImageSearchResponse = {
  results?: BraveImageResult[];
};

export async function GET(req: NextRequest) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Image search isn't configured yet. Set BRAVE_SEARCH_API_KEY in your environment." },
      { status: 500 }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 });
  }

  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", q);
  url.searchParams.set("count", "10");
  url.searchParams.set("safesearch", "strict");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[Bottle Image Search] Brave API error:", res.status, errBody);
      return NextResponse.json(
        { error: `Image search failed (${res.status})`, details: errBody },
        { status: res.status }
      );
    }

    const data = (await res.json()) as BraveImageSearchResponse;

    const results = (data.results || [])
      .map((item) => {
        const imageUrl = item.properties?.url || item.thumbnail?.src;
        if (!imageUrl) return null;
        return {
          title: item.title || "",
          imageUrl,
          thumbnailUrl: item.thumbnail?.src || imageUrl,
          sourceUrl: item.url || item.source || "",
        };
      })
      .filter((r): r is { title: string; imageUrl: string; thumbnailUrl: string; sourceUrl: string } => r !== null);

    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Bottle Image Search] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image search failed" },
      { status: 500 }
    );
  }
}
