import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import Stripe from "stripe";
import {
  createPromotion,
  listPromotions,
  updatePromotion,
  deletePromotion,
  getPromotionById,
  getPromotionByCode,
} from "@/lib/promotionsStore";
import { Promotion } from "@/lib/promotions";

export const runtime = "nodejs";

// Initialize Stripe
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-09-30.clover" });
}

// GET - List all promotions
export async function GET(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const promotions = await listPromotions();
    return NextResponse.json({ promotions });
  } catch (error: unknown) {
    console.error("[Promotions API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch promotions" },
      { status: 500 }
    );
  }
}

// POST - Create new promotion
export async function POST(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      code,
      name,
      description,
      trigger,
      type,
      discountPercent,
      discountAmountCents,
      minQuantity,
      applyToQuantity,
      minOrderAmountCents,
      maxRedemptions,
      maxRedemptionsPerCustomer,
      userTargeting,
      targetUserIds,
      minOrderCount,
      minLifetimeSpendCents,
      applicableProductSlugs,
      startsAt,
      expiresAt,
      active,
    } = body;

    // Validation
    if (!code || !name || !type) {
      return NextResponse.json(
        { error: "Code, name, and type are required" },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await getPromotionByCode(code);
    if (existing) {
      return NextResponse.json(
        { error: "Promotion code already exists" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const promotionId = `promo_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    let stripeCouponId: string | undefined;
    let stripePromotionCodeId: string | undefined;

    // Create Stripe coupon/promotion code for applicable types
    if (type === "percentage" || type === "fixed_amount") {
      // Create Stripe coupon
      const couponParams: Stripe.CouponCreateParams = {
        name: name,
        metadata: { promotionId },
      };

      if (type === "percentage" && discountPercent) {
        couponParams.percent_off = discountPercent;
      } else if (type === "fixed_amount" && discountAmountCents) {
        couponParams.amount_off = discountAmountCents;
        couponParams.currency = "usd";
      }

      if (maxRedemptions) {
        couponParams.max_redemptions = maxRedemptions;
      }

      if (expiresAt) {
        couponParams.redeem_by = Math.floor(
          new Date(expiresAt).getTime() / 1000
        );
      }

      const coupon = await stripe.coupons.create(couponParams);
      stripeCouponId = coupon.id;

      // Create promotion code
      const restrictions: Stripe.PromotionCodeCreateParams.Restrictions = {};

      if (minOrderAmountCents) {
        restrictions.minimum_amount = minOrderAmountCents;
        restrictions.minimum_amount_currency = "usd";
      }

      if (userTargeting === "first_time") {
        restrictions.first_time_transaction = true;
      }

      const promoCodeParams = {
        coupon: stripeCouponId,
        code: code.toUpperCase(),
        active: active !== false,
        ...(Object.keys(restrictions).length > 0 && { restrictions }),
      };

      const promoCode = await stripe.promotionCodes.create(
        promoCodeParams as unknown as Stripe.PromotionCodeCreateParams
      );
      stripePromotionCodeId = promoCode.id;
    }

    // Create promotion in our database
    const promotion: Promotion = {
      id: promotionId,
      stripeCouponId,
      stripePromotionCodeId,
      code: code.toUpperCase(),
      name,
      description,
      trigger: trigger || "code_required",
      type,
      discountPercent,
      discountAmountCents,
      minQuantity,
      applyToQuantity,
      minOrderAmountCents,
      maxRedemptions,
      maxRedemptionsPerCustomer,
      userTargeting: userTargeting || "all",
      targetUserIds,
      minOrderCount,
      minLifetimeSpendCents,
      applicableProductSlugs,
      startsAt,
      expiresAt,
      active: active !== false,
      currentRedemptions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createPromotion(promotion);

    return NextResponse.json({ promotion }, { status: 201 });
  } catch (error: unknown) {
    console.error("[Promotions API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create promotion" },
      { status: 500 }
    );
  }
}

// PATCH - Update promotion
export async function PATCH(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Promotion ID required" },
        { status: 400 }
      );
    }

    const existing = await getPromotionById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 }
      );
    }

    // Update Stripe promotion code if active status changed
    if (existing.stripePromotionCodeId && updates.active !== undefined) {
      const stripe = getStripe();
      await stripe.promotionCodes.update(existing.stripePromotionCodeId, {
        active: updates.active,
      });
    }

    await updatePromotion(id, updates);
    const updated = await getPromotionById(id);

    return NextResponse.json({ promotion: updated });
  } catch (error: unknown) {
    console.error("[Promotions API] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update promotion" },
      { status: 500 }
    );
  }
}

// DELETE - Delete promotion
export async function DELETE(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Promotion ID required" },
        { status: 400 }
      );
    }

    const existing = await getPromotionById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 }
      );
    }

    // Deactivate Stripe promotion code (don't delete to preserve history)
    if (existing.stripePromotionCodeId) {
      const stripe = getStripe();
      await stripe.promotionCodes.update(existing.stripePromotionCodeId, {
        active: false,
      });
    }

    await deletePromotion(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[Promotions API] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete promotion" },
      { status: 500 }
    );
  }
}