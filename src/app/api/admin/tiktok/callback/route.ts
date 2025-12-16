// OAuth callback handler for TikTok Shop authorization
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/tiktokShop";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    console.error("[TikTok Shop] OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/admin?tiktok_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin?tiktok_error=no_code", req.url)
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/admin/tiktok/callback`;

    // Exchange code for access token
    await exchangeCodeForToken(code, redirectUri);

    // Redirect back to admin with success message
    return NextResponse.redirect(
      new URL("/admin?tiktok_success=true", req.url)
    );
  } catch (error) {
    console.error("[TikTok Shop] Token exchange failed:", error);
    return NextResponse.redirect(
      new URL(
        `/admin?tiktok_error=${encodeURIComponent(error instanceof Error ? error.message : "token_exchange_failed")}`,
        req.url
      )
    );
  }
}
