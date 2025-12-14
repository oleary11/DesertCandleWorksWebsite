import { NextRequest, NextResponse } from "next/server";
import { getUploadSession } from "@/lib/mobileUpload";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    const session = await getUploadSession(token);

    if (!session) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired session" },
        { status: 200 }
      );
    }

    if (session.completed) {
      return NextResponse.json(
        { valid: false, error: "Upload session has been completed" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        uploadedCount: session.uploadedImages.length,
        expiresAt: session.expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Mobile Upload Status] Error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to check session status" },
      { status: 500 }
    );
  }
}
