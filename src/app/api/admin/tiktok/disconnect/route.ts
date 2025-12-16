// API route to disconnect TikTok Shop
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { disconnectTikTokShop } from "@/lib/tiktokShop";

export async function POST() {
  // Verify admin is authenticated
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await disconnectTikTokShop();

    return NextResponse.json({
      success: true,
      message: "TikTok Shop disconnected successfully",
    });
  } catch (error) {
    console.error("[TikTok Shop] Disconnect failed:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect TikTok Shop",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
