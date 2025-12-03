import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllContainers, upsertContainer, deleteContainer, type Container } from "@/lib/containers";

export const runtime = "nodejs";

// GET /api/admin/containers - List all containers
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const containers = await getAllContainers();
  return NextResponse.json({ containers });
}

// POST /api/admin/containers - Create or update a container
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const container = body as Container;

    // Validate required fields
    if (!container.id || !container.name || container.capacityWaterOz === undefined || container.costPerUnit === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, capacityWaterOz, costPerUnit" },
        { status: 400 }
      );
    }

    // Validate ID format (lowercase, alphanumeric, hyphens/underscores only)
    if (!/^[a-z0-9_-]+$/.test(container.id)) {
      return NextResponse.json(
        { error: "Container ID must be lowercase alphanumeric with hyphens/underscores only" },
        { status: 400 }
      );
    }

    // Validate numeric values are positive
    if (container.capacityWaterOz <= 0 || container.costPerUnit < 0) {
      return NextResponse.json(
        { error: "Capacity must be positive and cost must be non-negative" },
        { status: 400 }
      );
    }

    await upsertContainer(container);

    return NextResponse.json({ success: true, container });
  } catch (error) {
    console.error("Failed to create/update container:", error);
    return NextResponse.json(
      { error: "Failed to create/update container" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/containers?id=container-id
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
        { error: "Missing container ID" },
        { status: 400 }
      );
    }

    await deleteContainer(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete container:", error);
    return NextResponse.json(
      { error: "Failed to delete container" },
      { status: 500 }
    );
  }
}
