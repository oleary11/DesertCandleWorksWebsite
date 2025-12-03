import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllWickTypes, upsertWickType, deleteWickType, type WickType } from "@/lib/calculatorSettings";

export const runtime = "nodejs";

// GET /api/admin/wick-types - List all wick types
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wicks = await getAllWickTypes();
  return NextResponse.json({ wicks });
}

// POST /api/admin/wick-types - Create or update a wick type
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const wick = body as WickType;

    // Validate required fields
    if (!wick.id || !wick.name || wick.costPerWick === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, costPerWick" },
        { status: 400 }
      );
    }

    // Validate ID format (lowercase, alphanumeric, hyphens/underscores only)
    if (!/^[a-z0-9_-]+$/.test(wick.id)) {
      return NextResponse.json(
        { error: "Wick type ID must be lowercase alphanumeric with hyphens/underscores only" },
        { status: 400 }
      );
    }

    // Validate cost is non-negative
    if (wick.costPerWick < 0) {
      return NextResponse.json(
        { error: "Cost per wick must be non-negative" },
        { status: 400 }
      );
    }

    await upsertWickType(wick);

    return NextResponse.json({ success: true, wick });
  } catch (error) {
    console.error("Failed to create/update wick type:", error);
    return NextResponse.json(
      { error: "Failed to create/update wick type" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/wick-types?id=wick-id
export async function DELETE(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing wick type ID" },
        { status: 400 }
      );
    }

    await deleteWickType(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete wick type:", error);
    return NextResponse.json(
      { error: "Failed to delete wick type" },
      { status: 500 }
    );
  }
}
