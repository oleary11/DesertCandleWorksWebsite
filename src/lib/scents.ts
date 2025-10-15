import { redis } from "./redis";

const SCENTS_KEY = "global:scents";
const SCENTS_INDEX_KEY = "global:scents:index";

export interface GlobalScent {
  id: string; // e.g., "vanilla", "lavender"
  name: string; // e.g., "Vanilla", "Lavender"
  experimental: boolean; // if true, only show on specific products
  enabledProducts?: string[]; // product slugs if experimental (empty = all products if not experimental)
  sortOrder?: number; // optional sort order for display
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
    // Non-experimental scents are available for all products
    if (!scent.experimental) return true;

    // Experimental scents only available for specific products
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
    { id: "unscented", name: "Unscented", experimental: false, sortOrder: 0 },
    { id: "vanilla", name: "Vanilla", experimental: false, sortOrder: 1 },
    { id: "lavender", name: "Lavender", experimental: false, sortOrder: 2 },
    { id: "cinnamon", name: "Cinnamon", experimental: false, sortOrder: 3 },
  ];

  for (const scent of defaultScents) {
    await upsertScent(scent);
  }
}
