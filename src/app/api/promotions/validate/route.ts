import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/userSession";
import { getPromotionByCode, listPromotions } from "@/lib/promotionsStore";
import { validatePromotion, findAutomaticPromotions } from "@/lib/promotionValidator";

export const runtime = "nodejs";

type CartItem = {
  productSlug: string;
  quantity: number;
  priceCents: number;
};

// POST - Validate a promotion code
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, cartItems } = body as { code?: string; cartItems: CartItem[] };

    if (!cartItems || !Array.isArray(cartItems)) {
      return NextResponse.json({ error: "Cart items are required" }, { status: 400 });
    }

    // Get user session
    const session = await getUserSession();
    const userId = session?.userId;
    const isGuest = !userId;

    // Calculate subtotal
    const subtotalCents = cartItems.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0
    );

    const context = {
      userId,
      isGuest,
      cartItems,
      subtotalCents,
    };

    // If code is provided, validate that specific promotion
    if (code) {
      const promotion = await getPromotionByCode(code);

      if (!promotion) {
        return NextResponse.json(
          { valid: false, error: "Invalid promotion code" },
          { status: 400 }
        );
      }

      const validation = await validatePromotion(promotion.id, context);

      if (!validation.valid) {
        return NextResponse.json({ valid: false, error: validation.error }, { status: 400 });
      }

      return NextResponse.json({
        valid: true,
        promotion: {
          id: promotion.id,
          code: promotion.code,
          name: promotion.name,
          type: promotion.type,
          discountPercent: validation.discountPercent,
          discountAmountCents: validation.discountAmountCents,
        },
      });
    }

    // If no code provided, find all applicable automatic promotions
    const allPromotions = await listPromotions();
    const automaticPromotions = await findAutomaticPromotions(context, allPromotions);

    if (automaticPromotions.length === 0) {
      return NextResponse.json({ valid: false, promotions: [] });
    }

    // Return the best automatic promotion
    const bestPromotion = automaticPromotions[0];
    const validation = await validatePromotion(bestPromotion.id, context);

    return NextResponse.json({
      valid: true,
      promotion: {
        id: bestPromotion.id,
        code: bestPromotion.code,
        name: bestPromotion.name,
        type: bestPromotion.type,
        discountPercent: validation.discountPercent,
        discountAmountCents: validation.discountAmountCents,
      },
    });
  } catch (error) {
    console.error("[Promotions Validate API] Error:", error);
    return NextResponse.json(
      { error: "Failed to validate promotion" },
      { status: 500 }
    );
  }
}
