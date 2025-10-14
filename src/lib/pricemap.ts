// src/lib/pricemap.ts
import { products as staticProducts, type Product, generateVariants } from "@/lib/products";
import { listProducts } from "@/lib/productsStore";

type PriceInfo = {
  slug: string;
  variantId?: string; // undefined for non-variant products
};

export async function getPriceToSlug(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    const live = await listProducts();
    for (const p of live) {
      if (p.stripePriceId) map.set(p.stripePriceId, p.slug);
    }
  } catch {
  }

  for (const p of staticProducts) {
    if (p.stripePriceId && !map.has(p.stripePriceId)) {
      map.set(p.stripePriceId, p.slug);
    }
  }

  return map;
}

/** Maps Stripe price ID to product slug + variant ID (for variant-aware stock decrement) */
export async function getPriceToProduct(): Promise<Map<string, PriceInfo>> {
  const map = new Map<string, PriceInfo>();

  try {
    const live = await listProducts();
    for (const p of live) {
      // Add base price ID (backward compat)
      if (p.stripePriceId) {
        map.set(p.stripePriceId, { slug: p.slug });
      }

      // Add variant price IDs (generated from variantConfig)
      if (p.variantConfig) {
        const variants = generateVariants(p);
        for (const v of variants) {
          if (v.stripePriceId) {
            map.set(v.stripePriceId, { slug: p.slug, variantId: v.id });
          }
        }
      }
    }
  } catch {
    // continue
  }

  // Fallback to static products
  for (const p of staticProducts as Product[]) {
    if (p.stripePriceId && !map.has(p.stripePriceId)) {
      map.set(p.stripePriceId, { slug: p.slug });
    }

    if (p.variantConfig) {
      const variants = generateVariants(p);
      for (const v of variants) {
        if (v.stripePriceId && !map.has(v.stripePriceId)) {
          map.set(v.stripePriceId, { slug: p.slug, variantId: v.id });
        }
      }
    }
  }

  return map;
}