import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllBaseOils, upsertBaseOil, deleteBaseOil, type BaseFragranceOil } from "@/lib/scents";

export const runtime = "nodejs";

// GET /api/admin/base-oils - List all base fragrance oils
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oils = await getAllBaseOils();
  return NextResponse.json({ oils });
}

// POST /api/admin/base-oils - Create or update a base oil
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const oil = body as BaseFragranceOil;

    // Validate required fields
    if (!oil.id || !oil.name || oil.costPerOz === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, costPerOz" },
        { status: 400 }
      );
    }

    // Validate ID format (lowercase, alphanumeric, hyphens/underscores only)
    if (!/^[a-z0-9_-]+$/.test(oil.id)) {
      return NextResponse.json(
        { error: "Base oil ID must be lowercase alphanumeric with hyphens/underscores only" },
        { status: 400 }
      );
    }

    // Validate cost is positive
    if (oil.costPerOz < 0) {
      return NextResponse.json(
        { error: "Cost per oz must be positive" },
        { status: 400 }
      );
    }

    await upsertBaseOil(oil);

    return NextResponse.json({ success: true, oil });
  } catch (error) {
    console.error("Failed to create/update base oil:", error);
    return NextResponse.json(
      { error: "Failed to create/update base oil" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/base-oils?id=oil-id
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
        { error: "Missing base oil ID" },
        { status: 400 }
      );
    }

    await deleteBaseOil(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete base oil:", error);
    return NextResponse.json(
      { error: "Failed to delete base oil" },
      { status: 500 }
    );
  }
}
