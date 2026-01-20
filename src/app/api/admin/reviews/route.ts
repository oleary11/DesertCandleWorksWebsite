import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import {
  getAllReviews,
  upsertReview,
  deleteReview,
  getReview,
  toggleReviewVisibility,
  generateReviewId,
  generateInitials,
  type GoogleReview,
} from "@/lib/reviewsStore";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

// GET /api/admin/reviews - List all reviews
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reviews = await getAllReviews();
  return NextResponse.json({ reviews });
}

// POST /api/admin/reviews - Create or update a review
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Check if updating existing or creating new
    let review: GoogleReview;
    const existing = body.id ? await getReview(body.id) : null;
    const isUpdate = existing !== null;

    if (isUpdate && existing) {
      // Update existing review
      review = {
        ...existing,
        ...body,
        reviewerInitials: body.reviewerInitials || generateInitials(body.reviewerName || existing.reviewerName),
      };
    } else {
      // Create new review
      if (!body.reviewerName || !body.text || !body.rating || !body.date) {
        await logAdminAction({
          action: "review.create",
          adminEmail: "admin",
          ip,
          userAgent,
          success: false,
          details: { reason: "missing_fields" },
        });
        return NextResponse.json(
          { error: "Missing required fields: reviewerName, text, rating, date" },
          { status: 400 }
        );
      }

      if (body.rating < 1 || body.rating > 5) {
        return NextResponse.json(
          { error: "Rating must be between 1 and 5" },
          { status: 400 }
        );
      }

      review = {
        id: generateReviewId(),
        reviewerName: body.reviewerName,
        reviewerInitials: body.reviewerInitials || generateInitials(body.reviewerName),
        rating: body.rating,
        text: body.text,
        date: body.date,
        importedAt: new Date().toISOString(),
        visible: body.visible ?? true,
        sortOrder: body.sortOrder,
      };
    }

    // Track changes if updating
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (isUpdate && existing) {
      (Object.keys(review) as (keyof GoogleReview)[]).forEach((key) => {
        if (JSON.stringify(existing[key]) !== JSON.stringify(review[key])) {
          changes[key] = { from: existing[key], to: review[key] };
        }
      });
    }

    await upsertReview(review);

    await logAdminAction({
      action: isUpdate ? "review.update" : "review.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        id: review.id,
        reviewerName: review.reviewerName,
        rating: review.rating,
        visible: review.visible,
        ...(isUpdate ? { changes } : {}),
      },
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Failed to create/update review:", error);
    await logAdminAction({
      action: "review.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to create/update review" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/reviews?id=review-id - Toggle visibility
export async function PATCH(req: NextRequest) {
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
      return NextResponse.json({ error: "Missing review ID" }, { status: 400 });
    }

    const review = await toggleReviewVisibility(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    await logAdminAction({
      action: "review.toggle_visibility",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        id: review.id,
        reviewerName: review.reviewerName,
        visible: review.visible,
      },
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Failed to toggle review visibility:", error);
    return NextResponse.json(
      { error: "Failed to toggle review visibility" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/reviews?id=review-id
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
        action: "review.delete",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "missing_id" },
      });
      return NextResponse.json({ error: "Missing review ID" }, { status: 400 });
    }

    const existing = await getReview(id);

    await deleteReview(id);

    await logAdminAction({
      action: "review.delete",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        id,
        reviewerName: existing?.reviewerName || id,
        rating: existing?.rating,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete review:", error);
    await logAdminAction({
      action: "review.delete",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    );
  }
}
