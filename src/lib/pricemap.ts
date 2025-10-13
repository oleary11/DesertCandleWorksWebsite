// src/lib/pricemap.ts
import { products as staticProducts } from "@/lib/products";
import { listProducts } from "@/lib/productsStore";

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