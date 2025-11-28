import { NextRequest, NextResponse } from "next/server";
import { requireAuth, destroyUserSession } from "@/lib/userSession";
import { deleteUser, verifyPassword, getUserById } from "@/lib/userStore";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password required to delete account" }, { status: 400 });
    }

    // Get user and verify password
    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPassword(user.email, password);
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Delete account
    await deleteUser(session.userId);

    // Destroy session
    await destroyUserSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
