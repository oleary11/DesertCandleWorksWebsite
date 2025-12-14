import { NextResponse } from "next/server";
import { createUploadSession } from "@/lib/mobileUpload";

export async function POST() {
  try {
    // Middleware already checks admin auth
    const session = await createUploadSession();

    return NextResponse.json({ token: session.token }, { status: 200 });
  } catch (error) {
    console.error("[Admin] Create upload session error:", error);
    return NextResponse.json(
      { error: "Failed to create upload session" },
      { status: 500 }
    );
  }
}
