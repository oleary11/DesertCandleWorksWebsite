import { redis } from "./redis";

const SETTINGS_KEY = "calculator:settings";
const WICKS_KEY = "calculator:wicks";
const WICKS_INDEX_KEY = "calculator:wicks:index";

export interface CalculatorSettings {
  waxCostPerOz: number; // cost per ounce of wax
  waterToWaxRatio: number; // ratio of wax weight to water volume (typically ~0.9)
  defaultFragranceLoad: number; // default fragrance load percentage (e.g., 0.08 for 8%)
  defaultProductDescription?: string; // template for auto-generated product descriptions
}

export interface WickType {
  id: string; // e.g., "wood_30mm", "cdn12"
  name: string; // e.g., "Wood 30mm", "CDN 12"
  costPerWick: number; // cost per wick (including shipping share)
  appearAs?: string; // How it appears in variant names (e.g., "Standard", "Wavy Wood Wick")
}

/* ---------- Calculator Settings ---------- */

/**
 * Get calculator settings (or defaults if not set)
 */
export async function getCalculatorSettings(): Promise<CalculatorSettings> {
  try {
    const data = await redis.get(SETTINGS_KEY);
    if (data) {
      return data as CalculatorSettings;
    }
    // Return defaults if not set
    return {
      waxCostPerOz: 157.64 / 720, // $157.64 for 45 lb (720 oz)
      waterToWaxRatio: 0.9,
      defaultFragranceLoad: 0.08, // 8%
      defaultProductDescription: "Hand-poured candle in an upcycled {{BOTTLE_NAME}} bottle.\n\ncoco apricot creme™ candle wax\n\nApprox. - {{WAX_OZ}} oz wax",
    };
  } catch (error) {
    console.error("Failed to get calculator settings:", error);
    return {
      waxCostPerOz: 157.64 / 720,
      waterToWaxRatio: 0.9,
      defaultFragranceLoad: 0.08,
      defaultProductDescription: "Hand-poured candle in an upcycled {{BOTTLE_NAME}} bottle.\n\ncoco apricot creme™ candle wax\n\nApprox. - {{WAX_OZ}} oz wax",
    };
  }
}

/**
 * Update calculator settings
 */
export async function updateCalculatorSettings(settings: CalculatorSettings): Promise<void> {
  try {
    await redis.set(SETTINGS_KEY, settings);
  } catch (error) {
    console.error("Failed to update calculator settings:", error);
    throw error;
  }
}

/* ---------- Wick Types ---------- */

/**
 * Get all wick types
 */
export async function getAllWickTypes(): Promise<WickType[]> {
  try {
    const wickIds = await redis.smembers(WICKS_INDEX_KEY);

    // If no wicks exist in Redis, initialize defaults
    if (!wickIds || wickIds.length === 0) {
      await initializeDefaultWickTypes();
      // Re-fetch after initialization
      const newWickIds = await redis.smembers(WICKS_INDEX_KEY);
      const wicks: WickType[] = [];
      for (const id of newWickIds) {
        const data = await redis.get(`${WICKS_KEY}:${id}`);
        if (data) {
          wicks.push(data as WickType);
        }
      }
      return wicks.sort((a, b) => a.name.localeCompare(b.name));
    }

    const wicks: WickType[] = [];
    for (const id of wickIds) {
      const data = await redis.get(`${WICKS_KEY}:${id}`);
      if (data) {
        wicks.push(data as WickType);
      }
    }

    return wicks.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to get wick types:", error);
    return getDefaultWickTypes();
  }
}

/**
 * Get default wick types
 */
function getDefaultWickTypes(): WickType[] {
  const SHIPPING_PER_WICK = 7.5 / 34.0; // $7.50 shipping / 34 wicks
  return [
    { id: "wood_30mm", name: "Wood 30mm", costPerWick: 1.25 + SHIPPING_PER_WICK, appearAs: "Wavy Wood Wick" },
    { id: "wood_20mm", name: "Wood 20mm", costPerWick: 8.25 / 10 + SHIPPING_PER_WICK, appearAs: "Wavy Wood Wick" },
    { id: "cdn12", name: "CDN 12", costPerWick: 7.5 / 10 + SHIPPING_PER_WICK, appearAs: "Standard" },
    { id: "cdn16", name: "CDN 16", costPerWick: 5.0 / 10 + SHIPPING_PER_WICK, appearAs: "Standard" },
  ];
}

/**
 * Get a single wick type by ID
 */
export async function getWickType(id: string): Promise<WickType | null> {
  try {
    const data = await redis.get(`${WICKS_KEY}:${id}`);
    if (!data) {
      // Check if it's a default
      const defaults = getDefaultWickTypes();
      return defaults.find((w) => w.id === id) || null;
    }
    return data as WickType;
  } catch (error) {
    console.error(`Failed to get wick type ${id}:`, error);
    return null;
  }
}

/**
 * Create or update a wick type
 */
export async function upsertWickType(wick: WickType): Promise<void> {
  try {
    await redis.set(`${WICKS_KEY}:${wick.id}`, wick);
    await redis.sadd(WICKS_INDEX_KEY, wick.id);
  } catch (error) {
    console.error(`Failed to upsert wick type ${wick.id}:`, error);
    throw error;
  }
}

/**
 * Delete a wick type
 */
export async function deleteWickType(id: string): Promise<void> {
  try {
    await redis.del(`${WICKS_KEY}:${id}`);
    await redis.srem(WICKS_INDEX_KEY, id);
  } catch (error) {
    console.error(`Failed to delete wick type ${id}:`, error);
    throw error;
  }
}

/**
 * Initialize default wick types if none exist
 */
export async function initializeDefaultWickTypes(): Promise<void> {
  const existing = await redis.smembers(WICKS_INDEX_KEY);
  if (existing && existing.length > 0) return;

  const defaults = getDefaultWickTypes();
  for (const wick of defaults) {
    await upsertWickType(wick);
  }
}
