// Promotions management using Postgres
import { db } from "./db/client";
import { promotions } from "./db/schema";
import { eq, sql as drizzleSql, desc } from "drizzle-orm";

// Re-export Promotion type from promotions.ts
export type { Promotion } from "./promotions";
import type { Promotion } from "./promotions";

// Type mapping helper for database enums
type DiscountType = "percentage" | "fixed_amount";

// Create promotion
export async function createPromotion(promotion: Promotion): Promise<void> {
  // Map promotion type to database discount type
  const discountType: DiscountType =
    promotion.type === "percentage" ? "percentage" : "fixed_amount";

  const discountValue =
    promotion.type === "percentage"
      ? promotion.discountPercent ?? 0
      : promotion.discountAmountCents ?? 0;

  await db.insert(promotions).values({
    id: promotion.id,
    code: promotion.code,
    description: promotion.description || null,
    discountType,
    discountValue,
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

  const discountType: DiscountType =
    merged.type === "percentage" ? "percentage" : "fixed_amount";

  const discountValue =
    merged.type === "percentage"
      ? merged.discountPercent ?? 0
      : merged.discountAmountCents ?? 0;

  await db
    .update(promotions)
    .set({
      code: merged.code,
      description: merged.description || null,
      discountType,
      discountValue,
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

// Increment redemption count
export async function incrementRedemptions(id: string): Promise<void> {
  await db
    .update(promotions)
    .set({
      currentRedemptions: drizzleSql`${promotions.currentRedemptions} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, id));
}

// Helper to map database row to Promotion type
function mapToPromotion(row: typeof promotions.$inferSelect): Promotion {
  const isPercentage = row.discountType === "percentage";

  return {
    id: row.id,
    code: row.code,
    name: row.code, // Use code as name since DB doesn't have separate name field
    description: row.description || undefined,
    trigger: "code_required", // Default since DB doesn't store this
    type: isPercentage ? "percentage" : "fixed_amount",
    discountPercent: isPercentage ? row.discountValue : undefined,
    discountAmountCents: !isPercentage ? row.discountValue : undefined,
    minOrderAmountCents: row.minPurchaseCents || undefined,
    maxRedemptions: row.maxRedemptions || undefined,
    userTargeting: "all", // Default since DB doesn't store this
    active: row.active,
    currentRedemptions: row.currentRedemptions,
    startsAt: row.startsAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
