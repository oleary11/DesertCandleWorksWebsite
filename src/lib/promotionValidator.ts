// Promotion validation logic
import { Promotion, PromotionValidationResult } from "./promotions";
import { getPromotionById } from "./promotionsStore";
import { getUserById, getUserOrders } from "./userStore";

type CartItem = {
  productSlug: string;
  quantity: number;
  priceCents: number;
};

type ValidationContext = {
  userId?: string;
  isGuest: boolean;
  cartItems: CartItem[];
  subtotalCents: number;
};

/**
 * Validate if a promotion can be applied to the current cart/user
 */
export async function validatePromotion(
  promotionId: string,
  context: ValidationContext
): Promise<PromotionValidationResult> {
  const promotion = await getPromotionById(promotionId);

  if (!promotion) {
    return { valid: false, error: "Promotion not found" };
  }

  // Check if promotion is active
  if (!promotion.active) {
    return { valid: false, error: "This promotion is no longer active" };
  }

  // Check timeline
  const now = new Date();
  if (promotion.startsAt && new Date(promotion.startsAt) > now) {
    return { valid: false, error: "This promotion has not started yet" };
  }

  if (promotion.expiresAt && new Date(promotion.expiresAt) < now) {
    return { valid: false, error: "This promotion has expired" };
  }

  // Check max redemptions
  if (promotion.maxRedemptions && promotion.currentRedemptions >= promotion.maxRedemptions) {
    return { valid: false, error: "This promotion has reached its maximum uses" };
  }

  // Check minimum order amount
  if (promotion.minOrderAmountCents && context.subtotalCents < promotion.minOrderAmountCents) {
    const minAmount = (promotion.minOrderAmountCents / 100).toFixed(2);
    return {
      valid: false,
      error: `Minimum order amount of $${minAmount} required`,
    };
  }

  // Check quantity requirements
  const totalQuantity = context.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  if (promotion.minQuantity && totalQuantity < promotion.minQuantity) {
    return {
      valid: false,
      error: `You need at least ${promotion.minQuantity} items in your cart`,
    };
  }

  // Check product restrictions
  if (promotion.applicableProductSlugs && promotion.applicableProductSlugs.length > 0) {
    const hasApplicableProduct = context.cartItems.some((item) =>
      promotion.applicableProductSlugs!.includes(item.productSlug)
    );

    if (!hasApplicableProduct) {
      return {
        valid: false,
        error: "This promotion is not applicable to items in your cart",
      };
    }
  }

  // User targeting validation
  if (context.userId) {
    await getUserById(context.userId); // Validate user exists
    const userOrders = await getUserOrders(context.userId);

    // First-time customers only
    if (promotion.userTargeting === "first_time") {
      const completedOrders = userOrders.filter((o) => o.status === "completed");
      if (completedOrders.length > 0) {
        return { valid: false, error: "This promotion is for first-time customers only" };
      }
    }

    // Returning customers only
    if (promotion.userTargeting === "returning") {
      const completedOrders = userOrders.filter((o) => o.status === "completed");
      if (completedOrders.length === 0) {
        return { valid: false, error: "This promotion is for returning customers only" };
      }
    }

    // Specific users
    if (promotion.userTargeting === "specific_users") {
      if (!promotion.targetUserIds || !promotion.targetUserIds.includes(context.userId)) {
        return { valid: false, error: "You are not eligible for this promotion" };
      }
    }

    // Order count requirement
    if (promotion.userTargeting === "order_count" && promotion.minOrderCount) {
      const completedOrders = userOrders.filter((o) => o.status === "completed");
      if (completedOrders.length < promotion.minOrderCount) {
        return {
          valid: false,
          error: `You need at least ${promotion.minOrderCount} completed orders to use this promotion`,
        };
      }
    }

    // Lifetime spend requirement
    if (promotion.userTargeting === "lifetime_spend" && promotion.minLifetimeSpendCents) {
      const completedOrders = userOrders.filter((o) => o.status === "completed");
      const lifetimeSpend = completedOrders.reduce((sum, o) => sum + o.totalCents, 0);

      if (lifetimeSpend < promotion.minLifetimeSpendCents) {
        const minSpend = (promotion.minLifetimeSpendCents / 100).toFixed(2);
        return {
          valid: false,
          error: `You need to have spent at least $${minSpend} to use this promotion`,
        };
      }
    }

    // Check per-customer redemption limit
    if (promotion.maxRedemptionsPerCustomer) {
      const userRedemptions = userOrders.filter(
        (o) => o.status === "completed" && o.promotionId === promotionId
      ).length;

      if (userRedemptions >= promotion.maxRedemptionsPerCustomer) {
        return {
          valid: false,
          error: "You have already used this promotion the maximum number of times",
        };
      }
    }
  } else if (context.isGuest) {
    // Guest checkout restrictions
    if (
      promotion.userTargeting === "returning" ||
      promotion.userTargeting === "specific_users" ||
      promotion.userTargeting === "order_count" ||
      promotion.userTargeting === "lifetime_spend"
    ) {
      return {
        valid: false,
        error: "Please sign in to use this promotion",
      };
    }
  }

  // Calculate discount
  const { discountAmountCents, discountPercent } = calculateDiscount(promotion, context);

  return {
    valid: true,
    discountAmountCents,
    discountPercent,
  };
}

/**
 * Calculate the discount amount for a promotion
 */
function calculateDiscount(
  promotion: Promotion,
  context: ValidationContext
): { discountAmountCents: number; discountPercent?: number } {
  let discountAmountCents = 0;
  let discountPercent: number | undefined;

  switch (promotion.type) {
    case "percentage":
      if (promotion.discountPercent) {
        discountPercent = promotion.discountPercent;
        discountAmountCents = Math.round(context.subtotalCents * (promotion.discountPercent / 100));
      }
      break;

    case "fixed_amount":
      if (promotion.discountAmountCents) {
        discountAmountCents = Math.min(promotion.discountAmountCents, context.subtotalCents);
      }
      break;

    case "quantity_discount":
      // Apply percentage discount if minimum quantity is met
      if (promotion.discountPercent && promotion.minQuantity) {
        const totalQuantity = context.cartItems.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQuantity >= promotion.minQuantity) {
          discountPercent = promotion.discountPercent;
          discountAmountCents = Math.round(
            context.subtotalCents * (promotion.discountPercent / 100)
          );
        }
      }
      break;

    case "bogo":
      // Calculate BOGO discount - get cheapest items free
      if (promotion.minQuantity && promotion.applyToQuantity) {
        // Filter applicable products
        let applicableItems = context.cartItems;
        if (promotion.applicableProductSlugs && promotion.applicableProductSlugs.length > 0) {
          applicableItems = context.cartItems.filter((item) =>
            promotion.applicableProductSlugs!.includes(item.productSlug)
          );
        }

        // Sort by price per unit (cheapest first)
        const sortedItems = applicableItems
          .map((item) => ({
            ...item,
            pricePerUnit: item.priceCents / item.quantity,
          }))
          .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

        // Calculate how many free items
        const totalQuantity = sortedItems.reduce((sum, item) => sum + item.quantity, 0);
        const sets = Math.floor(totalQuantity / promotion.minQuantity);
        const freeItems = Math.min(sets * promotion.applyToQuantity, totalQuantity);

        // Apply discount to cheapest items
        let remainingFree = freeItems;
        for (const item of sortedItems) {
          if (remainingFree <= 0) break;

          const freeFromThisItem = Math.min(item.quantity, remainingFree);
          discountAmountCents += Math.round(freeFromThisItem * item.pricePerUnit);
          remainingFree -= freeFromThisItem;
        }
      }
      break;
  }

  return { discountAmountCents, discountPercent };
}

/**
 * Find all automatic promotions that apply to the current cart
 */
export async function findAutomaticPromotions(
  context: ValidationContext,
  allPromotions: Promotion[]
): Promise<Promotion[]> {
  const applicablePromotions: Promotion[] = [];

  for (const promotion of allPromotions) {
    // Only check automatic promotions
    if (promotion.trigger !== "automatic") continue;

    const validation = await validatePromotion(promotion.id, context);
    if (validation.valid) {
      applicablePromotions.push(promotion);
    }
  }

  // Sort by discount amount (highest first)
  applicablePromotions.sort((a, b) => {
    const aDiscount = calculateDiscount(a, context).discountAmountCents;
    const bDiscount = calculateDiscount(b, context).discountAmountCents;
    return bDiscount - aDiscount;
  });

  return applicablePromotions;
}
