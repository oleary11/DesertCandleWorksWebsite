import { NextResponse } from "next/server";
import { destroyUserSession } from "@/lib/userSession";

export async function POST() {
  try {
    await destroyUserSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth] Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
