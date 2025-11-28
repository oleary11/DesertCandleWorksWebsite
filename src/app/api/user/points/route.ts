import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/userSession";
import { getUserById, getUserPointsTransactions } from "@/lib/userStore";

export async function GET() {
  try {
    const session = await requireAuth();
    const [user, transactions] = await Promise.all([
      getUserById(session.userId),
      getUserPointsTransactions(session.userId, 100),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      points: user.points,
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[User] Get points error:", error);
    return NextResponse.json({ error: "Failed to get points" }, { status: 500 });
  }
}
