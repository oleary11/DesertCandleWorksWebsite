import { NextResponse } from "next/server";

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
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

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

    // Include both images and videos (reels), exclude carousels for simplicity
    const posts = data.data
      .filter((post) => post.media_type === "IMAGE" || post.media_type === "VIDEO")
      .slice(0, 4);

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
