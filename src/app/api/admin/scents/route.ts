import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllScents, upsertScent, deleteScent, getScent, type GlobalScent } from "@/lib/scents";
import { logAdminAction } from "@/lib/adminLogs";

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
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const scent = body as GlobalScent;

    // Validate required fields
    if (!scent.id || !scent.name) {
      await logAdminAction({
        action: "scent.create",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "missing_fields", id: scent.id },
      });
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    // Validate ID format (lowercase, alphanumeric, hyphens only)
    if (!/^[a-z0-9-]+$/.test(scent.id)) {
      await logAdminAction({
        action: "scent.create",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "invalid_id_format", id: scent.id },
      });
      return NextResponse.json(
        { error: "Scent ID must be lowercase alphanumeric with hyphens only" },
        { status: 400 }
      );
    }

    // Check if updating existing or creating new
    const existing = await getScent(scent.id);
    const isUpdate = existing !== null;

    // Track changes if updating
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (isUpdate && existing) {
      (Object.keys(scent) as (keyof GlobalScent)[]).forEach((key) => {
        if (JSON.stringify(existing[key]) !== JSON.stringify(scent[key])) {
          changes[key] = { from: existing[key], to: scent[key] };
        }
      });
    }

    await upsertScent(scent);

    await logAdminAction({
      action: isUpdate ? "scent.update" : "scent.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        id: scent.id,
        name: scent.name,
        limited: scent.limited,
        ...(isUpdate ? { changes } : {}),
      },
    });

    return NextResponse.json({ success: true, scent });
  } catch (error) {
    console.error("Failed to create/update scent:", error);
    await logAdminAction({
      action: "scent.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to create/update scent" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/scents?id=scent-id
export async function DELETE(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      await logAdminAction({
        action: "scent.delete",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "missing_id" },
      });
      return NextResponse.json(
        { error: "Missing scent ID" },
        { status: 400 }
      );
    }

    const existing = await getScent(id);

    await deleteScent(id);

    await logAdminAction({
      action: "scent.delete",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        id,
        name: existing?.name || id,
        limited: existing?.limited,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete scent:", error);
    await logAdminAction({
      action: "scent.delete",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to delete scent" },
      { status: 500 }
    );
  }
}
