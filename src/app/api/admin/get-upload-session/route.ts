import { NextRequest, NextResponse } from "next/server";
import { getUploadSession } from "@/lib/mobileUpload";

export async function GET(req: NextRequest) {
  try {
    // Middleware already checks admin auth
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const session = await getUploadSession(token);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session, { status: 200 });
  } catch (error) {
    console.error("[Admin] Get upload session error:", error);
    return NextResponse.json(
      { error: "Failed to get upload session" },
      { status: 500 }
    );
  }
}
