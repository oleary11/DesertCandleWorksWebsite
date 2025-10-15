import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { initializeDefaultScents } from "@/lib/scents";

export const runtime = "nodejs";

// POST /api/admin/init-scents - Initialize default scents (admin only)
export async function POST() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initializeDefaultScents();
    return NextResponse.json({ success: true, message: "Default scents initialized" });
  } catch (error) {
    console.error("Failed to initialize scents:", error);
    return NextResponse.json(
      { error: "Failed to initialize scents" },
      { status: 500 }
    );
  }
}
