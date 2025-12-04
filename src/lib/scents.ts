import { redis } from "./redis";

const SCENTS_KEY = "global:scents";
const SCENTS_INDEX_KEY = "global:scents:index";
const BASE_OILS_KEY = "global:base_oils";
const BASE_OILS_INDEX_KEY = "global:base_oils:index";

// Base fragrance oil used in composition
export interface BaseFragranceOil {
  id: string; // e.g., "bonfire_embers", "lavender_oil"
  name: string; // e.g., "Bonfire Embers", "Lavender Oil"
  costPerOz: number; // cost per ounce (including shipping if applicable)
}

// Composition of a scent from base oils
export interface ScentComposition {
  baseOilId: string; // references BaseFragranceOil.id
  percentage: number; // percentage of this base oil in the blend (0-100)
}

export interface GlobalScent {
  id: string; // e.g., "vanilla", "lavender"
  name: string; // e.g., "Vanilla", "Lavender"
  limited: boolean; // if true, only show on specific products
  enabledProducts?: string[]; // product slugs if limited (empty = all products if not limited)
  sortOrder?: number; // optional sort order for display
  notes?: string[]; // scent notes/components (e.g., ["Leather", "Bonfire Embers"])
  seasonal?: boolean; // if true, marks this scent as seasonal (for filtering in shop)

  // Cost calculation fields (for admin use only)
  costPerOz?: number; // Direct cost per oz (if not using composition)
  composition?: ScentComposition[]; // Blend composition from base oils
}

/**
 * Get all global scents
 */
export async function getAllScents(): Promise<GlobalScent[]> {
  try {
    const scentIds = await redis.smembers(SCENTS_INDEX_KEY);
    if (!scentIds || scentIds.length === 0) return [];

    const scents: GlobalScent[] = [];
    for (const id of scentIds) {
      const data = await redis.get(`${SCENTS_KEY}:${id}`);
      if (data) {
        // @vercel/kv automatically parses JSON, so data is already an object
        scents.push(data as GlobalScent);
      }
    }

    // Sort by sortOrder, then by name
    return scents.sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("Failed to get scents:", error);
    return [];
  }
}

/**
 * Get scents available for a specific product
 * @param productSlug - The product slug to check
 * @returns Array of scents available for this product
 */
export async function getScentsForProduct(productSlug: string): Promise<GlobalScent[]> {
  const allScents = await getAllScents();

  return allScents.filter((scent) => {
    // Favorites scents are available for all products
    if (!scent.limited) return true;

    // Limited scents only available for specific products
    return scent.enabledProducts?.includes(productSlug) ?? false;
  });
}

/**
 * Get a single scent by ID
 */
export async function getScent(id: string): Promise<GlobalScent | null> {
  try {
    const data = await redis.get(`${SCENTS_KEY}:${id}`);
    if (!data) return null;
    // @vercel/kv automatically parses JSON, so data is already an object
    return data as GlobalScent;
  } catch (error) {
    console.error(`Failed to get scent ${id}:`, error);
    return null;
  }
}

/**
 * Create or update a scent
 */
export async function upsertScent(scent: GlobalScent): Promise<void> {
  try {
    // @vercel/kv automatically stringifies JSON, so just pass the object
    await redis.set(`${SCENTS_KEY}:${scent.id}`, scent);
    await redis.sadd(SCENTS_INDEX_KEY, scent.id);
  } catch (error) {
    console.error(`Failed to upsert scent ${scent.id}:`, error);
    throw error;
  }
}

/**
 * Delete a scent
 */
export async function deleteScent(id: string): Promise<void> {
  try {
    await redis.del(`${SCENTS_KEY}:${id}`);
    await redis.srem(SCENTS_INDEX_KEY, id);
  } catch (error) {
    console.error(`Failed to delete scent ${id}:`, error);
    throw error;
  }
}

/**
 * Initialize with default scents if none exist
 */
export async function initializeDefaultScents(): Promise<void> {
  const existing = await getAllScents();
  if (existing.length > 0) return;

  const defaultScents: GlobalScent[] = [
    { id: "unscented", name: "Unscented", limited: false, sortOrder: 0 },
    { id: "vanilla", name: "Vanilla", limited: false, sortOrder: 1 },
    { id: "lavender", name: "Lavender", limited: false, sortOrder: 2 },
    { id: "cinnamon", name: "Cinnamon", limited: false, sortOrder: 3 },
  ];

  for (const scent of defaultScents) {
    await upsertScent(scent);
  }
}

/* ---------- Base Fragrance Oil Management ---------- */

/**
 * Get all base fragrance oils
 */
export async function getAllBaseOils(): Promise<BaseFragranceOil[]> {
  try {
    const oilIds = await redis.smembers(BASE_OILS_INDEX_KEY);
    if (!oilIds || oilIds.length === 0) return [];

    const oils: BaseFragranceOil[] = [];
    for (const id of oilIds) {
      const data = await redis.get(`${BASE_OILS_KEY}:${id}`);
      if (data) {
        oils.push(data as BaseFragranceOil);
      }
    }

    return oils.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to get base oils:", error);
    return [];
  }
}

/**
 * Get a single base oil by ID
 */
export async function getBaseOil(id: string): Promise<BaseFragranceOil | null> {
  try {
    const data = await redis.get(`${BASE_OILS_KEY}:${id}`);
    if (!data) return null;
    return data as BaseFragranceOil;
  } catch (error) {
    console.error(`Failed to get base oil ${id}:`, error);
    return null;
  }
}

/**
 * Create or update a base fragrance oil
 */
export async function upsertBaseOil(oil: BaseFragranceOil): Promise<void> {
  try {
    await redis.set(`${BASE_OILS_KEY}:${oil.id}`, oil);
    await redis.sadd(BASE_OILS_INDEX_KEY, oil.id);
  } catch (error) {
    console.error(`Failed to upsert base oil ${oil.id}:`, error);
    throw error;
  }
}

/**
 * Delete a base fragrance oil
 */
export async function deleteBaseOil(id: string): Promise<void> {
  try {
    await redis.del(`${BASE_OILS_KEY}:${id}`);
    await redis.srem(BASE_OILS_INDEX_KEY, id);
  } catch (error) {
    console.error(`Failed to delete base oil ${id}:`, error);
    throw error;
  }
}

/**
 * Calculate cost per oz for a scent based on its composition
 */
export function calculateScentCost(scent: GlobalScent, baseOils: BaseFragranceOil[]): number {
  // If direct cost is provided, use that
  if (scent.costPerOz !== undefined) {
    return scent.costPerOz;
  }

  // Otherwise calculate from composition
  if (!scent.composition || scent.composition.length === 0) {
    return 0;
  }

  const oilsMap = new Map(baseOils.map(oil => [oil.id, oil]));
  let totalCost = 0;
  let totalPercentage = 0;

  for (const comp of scent.composition) {
    const baseOil = oilsMap.get(comp.baseOilId);
    if (baseOil) {
      totalCost += (comp.percentage / 100) * baseOil.costPerOz;
      totalPercentage += comp.percentage;
    }
  }

  // Warn if percentages don't add up to 100
  if (Math.abs(totalPercentage - 100) > 0.01) {
    console.warn(`Scent ${scent.id} composition percentages total ${totalPercentage}%, not 100%`);
  }

  return totalCost;
}
