// /lib/liveProduct.ts
import { getProduct as getStaticProduct } from "@/lib/products";
import { getProductBySlug } from "@/lib/productsStore";
import type { Product } from "@/lib/productsStore";

export async function getResolvedProduct(slug: string): Promise<Product | null> {
  const live = await getProductBySlug(slug);
  if (live) {
    // Ensure live products have variantConfig
    if (!live.variantConfig) {
      live.variantConfig = {
        wickTypes: [{ id: "standard", name: "Standard Wick" }],
        variantData: {},
      };
    }
    return live;
  }

  const s = getStaticProduct(slug);
  if (!s) return null;

  // Auto-migrate static products to use variants
  return {
    ...s,
    stock: s.stock ?? 0,
    variantConfig: s.variantConfig || {
      wickTypes: [{ id: "standard", name: "Standard Wick" }],
      variantData: {},
    },
  };
}