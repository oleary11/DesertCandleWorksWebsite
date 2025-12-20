// Redis-backed promotion storage
import { kv } from "@vercel/kv";
import { Promotion } from "./promotions";

const PROMOTIONS_INDEX = "promotions:index";
const PROMOTION_PREFIX = "promotion:";

// Create promotion
export async function createPromotion(promotion: Promotion): Promise<void> {
  await kv.set(`${PROMOTION_PREFIX}${promotion.id}`, promotion);
  await kv.sadd(PROMOTIONS_INDEX, promotion.id);
}

// Get promotion by ID
export async function getPromotionById(id: string): Promise<Promotion | null> {
  const data = await kv.get<Promotion>(`${PROMOTION_PREFIX}${id}`);
  return data || null;
}

// Get promotion by code
export async function getPromotionByCode(code: string): Promise<Promotion | null> {
  const promotions = await listPromotions();
  return promotions.find((p) => p.code.toLowerCase() === code.toLowerCase()) || null;
}

// List all promotions
export async function listPromotions(): Promise<Promotion[]> {
  const ids = await kv.smembers(PROMOTIONS_INDEX);
  if (!ids || ids.length === 0) return [];

  const promotions: Promotion[] = [];
  for (const id of ids) {
    const promo = await getPromotionById(id as string);
    if (promo) promotions.push(promo);
  }

  // Sort by createdAt descending
  return promotions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Update promotion
export async function updatePromotion(id: string, updates: Partial<Promotion>): Promise<void> {
  const existing = await getPromotionById(id);
  if (!existing) throw new Error("Promotion not found");

  const updated: Promotion = {
    ...existing,
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`${PROMOTION_PREFIX}${id}`, updated);
}

// Delete promotion
export async function deletePromotion(id: string): Promise<void> {
  await kv.del(`${PROMOTION_PREFIX}${id}`);
  await kv.srem(PROMOTIONS_INDEX, id);
}

// Increment redemption count
export async function incrementRedemptions(id: string): Promise<void> {
  const promo = await getPromotionById(id);
  if (!promo) return;

  await updatePromotion(id, {
    currentRedemptions: promo.currentRedemptions + 1,
  });
}
