import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { listAllUsers } from "@/lib/userStore";

export const runtime = "nodejs";

// GET - List all customer users for admin
export async function GET(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await listAllUsers();

    // Return simplified user data for selection
    const simplifiedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    }));

    return NextResponse.json({ users: simplifiedUsers });
  } catch (error) {
    console.error("[Customers API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}
