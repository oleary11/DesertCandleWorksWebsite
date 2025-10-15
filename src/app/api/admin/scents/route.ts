import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllScents, upsertScent, deleteScent, type GlobalScent } from "@/lib/scents";

export const runtime = "nodejs";

// GET /api/admin/scents - List all scents
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scents = await getAllScents();
  return NextResponse.json({ scents });
}

// POST /api/admin/scents - Create or update a scent
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const scent = body as GlobalScent;

    // Validate required fields
    if (!scent.id || !scent.name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    // Validate ID format (lowercase, alphanumeric, hyphens only)
    if (!/^[a-z0-9-]+$/.test(scent.id)) {
      return NextResponse.json(
        { error: "Scent ID must be lowercase alphanumeric with hyphens only" },
        { status: 400 }
      );
    }

    await upsertScent(scent);

    return NextResponse.json({ success: true, scent });
  } catch (error) {
    console.error("Failed to create/update scent:", error);
    return NextResponse.json(
      { error: "Failed to create/update scent" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/scents?id=scent-id
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
        { error: "Missing scent ID" },
        { status: 400 }
      );
    }

    await deleteScent(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete scent:", error);
    return NextResponse.json(
      { error: "Failed to delete scent" },
      { status: 500 }
    );
  }
}
