import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/userStore";
import { createUserSession } from "@/lib/userSession";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName } = body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Create user
    const user = await createUser(email, password, firstName, lastName);

    // Create session
    await createUserSession(user.id, user.email);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          points: user.points,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Auth] Registration error:", error);

    if (error instanceof Error && error.message === "Email already registered") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
