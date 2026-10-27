import { NextResponse } from "next/server";
import { instagramLoginToken } from "@/lib/social/igToken";

export const runtime = "nodejs";
export const revalidate = 3600; // Cache for 1 hour

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string; // For videos/reels
  permalink: string;
  timestamp: string;
};

type InstagramResponse = {
  data: InstagramMedia[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
};

export async function GET() {
  // The posting token (renewed weekly) can read the feed too; the old feed-only token is a
  // fallback.
  const accessToken = (await instagramLoginToken()) || process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Instagram access token not configured" },
      { status: 500 }
    );
  }

  try {
    // Fetch recent media including thumbnail_url for videos/reels
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${accessToken}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("[Instagram API] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch Instagram posts", details: error },
        { status: response.status }
      );
    }

    const data: InstagramResponse = await response.json();

    // Images, reels and carousels (a carousel's media_url is its first slide)
    const posts = data.data.filter((post) => post.media_url || post.thumbnail_url).slice(0, 4);

    return NextResponse.json({
      posts: posts,
      success: true,
    });
  } catch (error) {
    console.error("[Instagram API] Fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Instagram posts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
