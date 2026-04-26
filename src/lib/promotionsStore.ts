// Promotions management using Postgres
import { db } from "./db/client";
import { promotions } from "./db/schema";
import { eq, sql as drizzleSql, desc } from "drizzle-orm";

// Re-export Promotion type from promotions.ts
export type { Promotion } from "./promotions";
import type { Promotion } from "./promotions";

// Type mapping helper for database enums
type DiscountType = "percentage" | "fixed_amount" | "bogo";

// Create promotion
export async function createPromotion(promotion: Promotion): Promise<void> {
  let discountType: DiscountType;
  let discountValue: number;

  if (promotion.type === "percentage") {
    discountType = "percentage";
    discountValue = promotion.discountPercent ?? 0;
  } else if (promotion.type === "bogo") {
    discountType = "bogo";
    discountValue = 0;
  } else {
    discountType = "fixed_amount";
    discountValue = promotion.discountAmountCents ?? 0;
  }

  await db.insert(promotions).values({
    id: promotion.id,
    code: promotion.code,
    description: promotion.description || null,
    discountType,
    discountValue,
    minQuantity: promotion.minQuantity ?? null,
    applyToQuantity: promotion.applyToQuantity ?? null,
    minPurchaseCents: promotion.minOrderAmountCents ?? 0,
    maxRedemptions: promotion.maxRedemptions || null,
    currentRedemptions: promotion.currentRedemptions,
    active: promotion.active,
    startsAt: promotion.startsAt ? new Date(promotion.startsAt) : null,
    expiresAt: promotion.expiresAt ? new Date(promotion.expiresAt) : null,
    createdAt: new Date(promotion.createdAt),
    updatedAt: new Date(promotion.updatedAt),
  });
}

// Get promotion by ID
export async function getPromotionById(id: string): Promise<Promotion | null> {
  const [promo] = await db
    .select()
    .from(promotions)
    .where(eq(promotions.id, id))
    .limit(1);

  if (!promo) return null;

  return mapToPromotion(promo);
}

// Get promotion by code
export async function getPromotionByCode(code: string): Promise<Promotion | null> {
  const normalizedCode = code.toLowerCase();
  const allPromotions = await listPromotions();

  return allPromotions.find((p) => p.code.toLowerCase() === normalizedCode) || null;
}

// List all promotions
export async function listPromotions(): Promise<Promotion[]> {
  const results = await db
    .select()
    .from(promotions)
    .orderBy(desc(promotions.createdAt));

  return results.map(mapToPromotion);
}

// Update promotion
export async function updatePromotion(id: string, updates: Partial<Promotion>): Promise<void> {
  const existing = await getPromotionById(id);
  if (!existing) throw new Error("Promotion not found");

  const merged: Promotion = {
    ...existing,
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString(),
  };

  let discountType: DiscountType;
  let discountValue: number;

  if (merged.type === "percentage") {
    discountType = "percentage";
    discountValue = merged.discountPercent ?? 0;
  } else if (merged.type === "bogo") {
    discountType = "bogo";
    discountValue = 0;
  } else {
    discountType = "fixed_amount";
    discountValue = merged.discountAmountCents ?? 0;
  }

  await db
    .update(promotions)
    .set({
      code: merged.code,
      description: merged.description || null,
      discountType,
      discountValue,
      minQuantity: merged.minQuantity ?? null,
      applyToQuantity: merged.applyToQuantity ?? null,
      minPurchaseCents: merged.minOrderAmountCents ?? 0,
      maxRedemptions: merged.maxRedemptions || null,
      currentRedemptions: merged.currentRedemptions,
      active: merged.active,
      startsAt: merged.startsAt ? new Date(merged.startsAt) : null,
      expiresAt: merged.expiresAt ? new Date(merged.expiresAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, id));
}

// Delete promotion
export async function deletePromotion(id: string): Promise<void> {
  await db.delete(promotions).where(eq(promotions.id, id));
}

// Increment redemption count and auto-deactivate if max uses is reached
export async function incrementRedemptions(id: string): Promise<void> {
  await db
    .update(promotions)
    .set({
      currentRedemptions: drizzleSql`${promotions.currentRedemptions} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, id));

  // Check if we just hit the max redemptions limit
  const updated = await getPromotionById(id);
  if (updated && updated.maxRedemptions && updated.currentRedemptions >= updated.maxRedemptions) {
    await db
      .update(promotions)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(promotions.id, id));
    console.log(`[Promotions] Auto-deactivated promotion ${id} after reaching max redemptions (${updated.maxRedemptions})`);
  }
}

// Helper to map database row to Promotion type
function mapToPromotion(row: typeof promotions.$inferSelect): Promotion {
  const isBogo = row.discountType === "bogo";
  const isPercentage = row.discountType === "percentage";

  return {
    id: row.id,
    code: row.code,
    name: row.code,
    description: row.description || undefined,
    trigger: "code_required",
    type: isBogo ? "bogo" : isPercentage ? "percentage" : "fixed_amount",
    discountPercent: isPercentage ? row.discountValue : undefined,
    discountAmountCents: !isPercentage && !isBogo ? row.discountValue : undefined,
    minQuantity: row.minQuantity ?? undefined,
    applyToQuantity: row.applyToQuantity ?? undefined,
    minOrderAmountCents: row.minPurchaseCents || undefined,
    maxRedemptions: row.maxRedemptions || undefined,
    userTargeting: "all",
    active: row.active,
    currentRedemptions: row.currentRedemptions,
    startsAt: row.startsAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
