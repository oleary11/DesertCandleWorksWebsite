// Promotion types and management
// Combines Stripe coupons with custom promotion logic

export type PromotionType =
  | "percentage" // e.g., 10% off
  | "fixed_amount" // e.g., $5 off
  | "quantity_discount" // e.g., Buy 3 get 10% off
  | "bogo"; // Buy one get one

export type PromotionTrigger = "code_required" | "automatic";

export type UserTargeting = "all" | "first_time" | "returning" | "specific_users" | "order_count" | "lifetime_spend";

export type Promotion = {
  id: string; // Our internal ID
  stripeCouponId?: string; // Stripe coupon ID (if applicable)
  stripePromotionCodeId?: string; // Stripe promotion code ID (if applicable)

  // Basic info
  code: string; // User-facing code (e.g., "SUMMER10")
  name: string; // Internal name (e.g., "Summer Sale 2024")
  description?: string;

  // Trigger method
  trigger: PromotionTrigger; // "code_required" or "automatic"

  // Discount settings
  type: PromotionType;
  discountPercent?: number; // For percentage discounts
  discountAmountCents?: number; // For fixed amount discounts

  // Quantity-based rules (for quantity_discount and bogo)
  minQuantity?: number; // e.g., "Buy 3"
  applyToQuantity?: number; // e.g., "Get 1 free" (for BOGO)

  // Restrictions
  minOrderAmountCents?: number; // Minimum cart total
  maxRedemptions?: number; // Total redemptions allowed
  maxRedemptionsPerCustomer?: number; // Per customer limit
  applicableProductSlugs?: string[]; // Empty = all products

  // User targeting
  userTargeting: UserTargeting; // Who can use this
  targetUserIds?: string[]; // Specific user IDs (if userTargeting === "specific_users")
  minOrderCount?: number; // If userTargeting === "order_count"
  minLifetimeSpendCents?: number; // If userTargeting === "lifetime_spend"

  // Timeline
  startsAt?: string; // ISO date
  expiresAt?: string; // ISO date

  // Status
  active: boolean;
  currentRedemptions: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
};

export type PromotionValidationResult = {
  valid: boolean;
  error?: string;
  discountAmountCents?: number;
  discountPercent?: number;
};
