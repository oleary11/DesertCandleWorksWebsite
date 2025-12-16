// API route to initiate TikTok Shop OAuth flow
import { NextResponse } from "next/server";
import { getTikTokAuthUrl } from "@/lib/tiktokShop";
import { isAdminAuthed } from "@/lib/adminSession";

export async function GET() {
  // Verify admin is authenticated
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/admin/tiktok/callback`;

    const authUrl = getTikTokAuthUrl(redirectUri);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("[TikTok Shop] Auth URL generation failed:", error);
    return NextResponse.json(
      {
        error: "Failed to generate authorization URL",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
