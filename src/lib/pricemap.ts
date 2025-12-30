// src/lib/pricemap.ts
import { products as staticProducts, type Product } from "@/lib/products";
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
      // Map base stripePriceId
      if (p.stripePriceId) map.set(p.stripePriceId, p.slug);

      // Map size-specific stripePriceIds
      if (p.variantConfig?.sizes) {
        for (const size of p.variantConfig.sizes) {
          if (size.stripePriceId) {
            map.set(size.stripePriceId, p.slug);
          }
        }
      }
    }
  } catch {
  }

  for (const p of staticProducts as Product[]) {
    if (p.stripePriceId && !map.has(p.stripePriceId)) {
      map.set(p.stripePriceId, p.slug);
    }

    // Map size-specific stripePriceIds from static products
    if (p.variantConfig?.sizes) {
      for (const size of p.variantConfig.sizes) {
        if (size.stripePriceId && !map.has(size.stripePriceId)) {
          map.set(size.stripePriceId, p.slug);
        }
      }
    }
  }

  return map;
}

/**
 * Maps Stripe price ID to product slug + variant ID (for variant-aware stock decrement)
 * NOTE: Since we now use single price IDs per product (not per variant),
 * variant information must be retrieved from Stripe session metadata.
 * This function maps both base product price IDs and size-specific price IDs -> product slug.
 */
export async function getPriceToProduct(): Promise<Map<string, PriceInfo>> {
  const map = new Map<string, PriceInfo>();

  try {
    const live = await listProducts();
    for (const p of live) {
      // Map product price ID to slug
      // Variant ID will be retrieved from session metadata in webhook
      if (p.stripePriceId) {
        map.set(p.stripePriceId, { slug: p.slug });
      }

      // Map size-specific stripePriceIds
      if (p.variantConfig?.sizes) {
        for (const size of p.variantConfig.sizes) {
          if (size.stripePriceId) {
            map.set(size.stripePriceId, { slug: p.slug });
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

    // Map size-specific stripePriceIds from static products
    if (p.variantConfig?.sizes) {
      for (const size of p.variantConfig.sizes) {
        if (size.stripePriceId && !map.has(size.stripePriceId)) {
          map.set(size.stripePriceId, { slug: p.slug });
        }
      }
    }
  }

  return map;
}