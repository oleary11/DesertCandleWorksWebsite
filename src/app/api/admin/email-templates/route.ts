import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { db } from "@/lib/db/client";
import { emailTemplates } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// Templates can carry a promotion look; add the column on first use (see drizzle/0017).
let designColumn: Promise<unknown> | null = null;
function ensureDesignColumn() {
  designColumn ??= db
    .execute(sql.raw(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "design" jsonb`))
    .catch((err) => {
      designColumn = null;
      throw err;
    });
  return designColumn;
}

export const runtime = "nodejs";

/**
 * GET /api/admin/email-templates
 * Fetch all email templates
 */
export async function GET(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDesignColumn();

  try {
    const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.createdAt);
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[Email Templates] Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email-templates
 * Create a new email template
 */
export async function POST(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDesignColumn();

  try {
    const body = await req.json();
    const { name, subject, message, isDefault, design } = body;

    if (!name || !subject || !message) {
      return NextResponse.json(
        { error: "Name, subject, and message are required" },
        { status: 400 }
      );
    }

    const [template] = await db
      .insert(emailTemplates)
      .values({
        name,
        subject,
        message,
        design: design ?? null,
        isDefault: isDefault || false,
      })
      .returning();

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[Email Templates] Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email-templates
 * Update an existing email template
 */
export async function PUT(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDesignColumn();

  try {
    const body = await req.json();
    const { id, name, subject, message, isDefault, design } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const [template] = await db
      .update(emailTemplates)
      .set({
        name,
        subject,
        message,
        ...(design !== undefined ? { design } : {}),
        isDefault,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[Email Templates] Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-templates
 * Delete an email template
 */
export async function DELETE(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDesignColumn();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Email Templates] Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", details: String(error) },
      { status: 500 }
    );
  }
}
