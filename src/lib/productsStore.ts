import { redis } from "./redis";
import { getProduct as getStaticProduct, type Product } from "@/lib/products";

export type {
  Product,
  ProductVariant,
  WickType,
  VariantConfig,
} from "@/lib/products";

const key = (slug: string) => `product:${slug}`;
const INDEX_KEY = "products:index";

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|1|yes|on)$/i.test(v.trim());
  if (typeof v === "number") return v === 1;
  return false;
}

export async function listProducts(): Promise<Product[]> {
  const slugs = (await redis.smembers(INDEX_KEY)) as string[];
  if (!Array.isArray(slugs) || slugs.length === 0) return [];
  const keys = slugs.map((s: string) => key(s));
  const raw = (await redis.mget(...keys)) as Array<Product | null>;
  const items = raw.filter((p): p is Product => Boolean(p));
  return items.sort((a: Product, b: Product) => a.name.localeCompare(b.name));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const p = (await redis.get(key(slug))) as Product | null;
  return p ?? null;
}

export async function upsertProduct(p: Product): Promise<Product> {
  if (!p.slug) throw new Error("Missing slug");
  await redis.set(key(p.slug), p);
  await redis.sadd(INDEX_KEY, p.slug);
  return p;
}

export async function deleteProduct(slug: string): Promise<void> {
  await redis.del(key(slug));
  await redis.srem(INDEX_KEY, slug);
}

/** Ensure a live (Redis) record exists, seeding from static if needed */
async function ensureLive(slug: string): Promise<Product> {
  const live = await getProductBySlug(slug);
  if (live) return live;

  const s = getStaticProduct(slug);
  if (!s) throw new Error("Not found");

  const seeded: Product = {
    ...s,
    stock: Math.max(0, Number(s.stock ?? 0)),
    price: Number(s.price),
    bestSeller: coerceBool(s.bestSeller),
    youngDumb: coerceBool(s.youngDumb),
  };
  await upsertProduct(seeded);
  return seeded;
}

export async function setStock(slug: string, value: number): Promise<number> {
  const p = await ensureLive(slug);
  p.stock = Math.max(0, Math.floor(value));
  await upsertProduct(p);
  return p.stock;
}

export async function incrStock(slug: string, delta: number): Promise<number> {
  const p = await ensureLive(slug);
  const next = (p.stock ?? 0) + Math.floor(delta);
  if (next < 0) throw new Error("Stock would go negative");
  p.stock = next;
  await upsertProduct(p);
  return p.stock;
}

/**
 * Get total stock across all variants (or fallback to base stock)
 * NOTE: This function counts ALL variants including limited scents.
 * For accurate stock counts that respect limited scent filtering,
 * use getTotalStockForProduct() instead.
 */
export function getTotalStock(p: Product): number {
  if (p.variantConfig) {
    // Sum stock directly from variantData without needing to generate full variants
    const { variantData } = p.variantConfig;
    let total = 0;
    for (const data of Object.values(variantData)) {
      total += data.stock ?? 0;
    }
    return total;
  }
  return p.stock ?? 0;
}

/**
 * Get total stock for a product, filtering out limited scents
 * This is async because it needs to fetch and filter global scents
 * Use this in server components for accurate stock counts
 */
export async function getTotalStockForProduct(p: Product): Promise<number> {
  if (!p.variantConfig) {
    return p.stock ?? 0;
  }

  try {
    // Import dynamically to avoid circular dependency
    const { getScentsForProduct } = await import("@/lib/scents");

    // Get allowed scents for this product (filters limited)
    const allowedScents = await getScentsForProduct(p.slug);

    // If no scents returned, fall back to counting all variants
    // This prevents showing 0 stock when Redis/scents fail to load
    if (!allowedScents || allowedScents.length === 0) {
      console.warn(`No scents found for product ${p.slug}, falling back to total stock`);
      return getTotalStock(p);
    }

    const allowedScentIds = new Set(allowedScents.map(s => s.id));

    // Sum stock only for variants with allowed scents
    const { variantData, wickTypes } = p.variantConfig;
    let total = 0;

    // Build a set of all wick IDs to properly extract scent IDs
    const wickIds = new Set(wickTypes.map(w => w.id));

    for (const [variantId, data] of Object.entries(variantData)) {
      // Extract scent ID from variant ID (format: "wickId-scentId")
      // We need to find which wick ID is used and remove it
      let scentId = variantId;
      for (const wickId of wickIds) {
        if (variantId.startsWith(wickId + '-')) {
          scentId = variantId.substring(wickId.length + 1);
          break;
        }
      }

      // Only count if scent is in allowed list
      if (allowedScentIds.has(scentId)) {
        total += data.stock ?? 0;
      }
    }

    return total;
  } catch (error) {
    // If there's any error fetching scents, fall back to counting all variants
    console.error(`Error calculating stock for ${p.slug}:`, error);
    return getTotalStock(p);
  }
}

/** Update stock for a specific variant */
export async function setVariantStock(
  slug: string,
  variantId: string,
  value: number
): Promise<Product> {
  const p = await ensureLive(slug);
  if (!p.variantConfig) throw new Error("Product has no variant configuration");

  // Update the variant data in the config
  if (!p.variantConfig.variantData[variantId]) {
    p.variantConfig.variantData[variantId] = { stock: 0 };
  }
  p.variantConfig.variantData[variantId].stock = Math.max(0, Math.floor(value));

  await upsertProduct(p);
  return p;
}

/** Increment/decrement stock for a specific variant */
export async function incrVariantStock(
  slug: string,
  variantId: string,
  delta: number
): Promise<Product> {
  const p = await ensureLive(slug);
  if (!p.variantConfig) throw new Error("Product has no variant configuration");

  // Ensure variant data exists
  if (!p.variantConfig.variantData[variantId]) {
    p.variantConfig.variantData[variantId] = { stock: 0 };
  }

  const current = p.variantConfig.variantData[variantId].stock ?? 0;
  const next = current + Math.floor(delta);
  if (next < 0) throw new Error("Variant stock would go negative");

  p.variantConfig.variantData[variantId].stock = next;
  await upsertProduct(p);
  return p;
}