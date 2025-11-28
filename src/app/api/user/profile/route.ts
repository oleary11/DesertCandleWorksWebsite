import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/userSession";
import { getUserById, updateUserProfile } from "@/lib/userStore";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Get profile error:", error);
    return NextResponse.json({ error: "Failed to get profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { firstName, lastName } = body;

    if (!firstName && !lastName) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const updates: { firstName?: string; lastName?: string } = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;

    const user = await updateUserProfile(session.userId, updates);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
