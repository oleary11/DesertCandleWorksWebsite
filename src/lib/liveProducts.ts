// /lib/liveProduct.ts
import { getProduct as getStaticProduct } from "@/lib/products";
import { getProductBySlug } from "@/lib/productsStore";
import type { Product } from "@/lib/productsStore";

export async function getResolvedProduct(slug: string): Promise<Product | null> {
  const live = await getProductBySlug(slug);
  if (live) {
    // Ensure live CANDLE products have a variantConfig (legacy migration for
    // old static-seed rows). Home Goods never has wick/scent variants — leave
    // it alone, or the storefront will try to render a candle-style picker.
    if (!live.variantConfig && live.productType !== "home_goods") {
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