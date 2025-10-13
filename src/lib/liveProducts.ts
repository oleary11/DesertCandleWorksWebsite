// /lib/liveProduct.ts
import { getProduct as getStaticProduct } from "@/lib/products";
import { getProductBySlug } from "@/lib/productsStore";
import type { Product } from "@/lib/productsStore";

export async function getResolvedProduct(slug: string): Promise<Product | null> {
  const live = await getProductBySlug(slug);
  if (live) return live;

  const s = getStaticProduct(slug);
  return s ? { ...s, stock: s.stock ?? 0 } : null;
}