// Turns product slugs picked on the Compose screen into what the promo email shows.

import { getPrimaryImage } from "@/lib/products";
import type { FramedProduct } from "@/lib/emailFrames";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export type PromoProductOption = FramedProduct & { slug: string };

function priceText(product: { price: number; variantConfig?: unknown }): string | undefined {
  if (!product.price) return undefined;
  const price = `$${product.price % 1 === 0 ? product.price : product.price.toFixed(2)}`;
  return product.variantConfig ? `From ${price}` : price;
}

/** Products that can be featured: visible on the site and with a photo. */
export async function listPromoProductOptions(): Promise<PromoProductOption[]> {
  const products = await listResolvedProducts();
  return products
    .filter((p) => p.visibleOnWebsite !== false && getPrimaryImage(p))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      imageUrl: getPrimaryImage(p),
      url: `/shop/${p.slug}`,
      priceText: priceText(p),
    }));
}

export async function resolvePromoProducts(slugs: string[]): Promise<FramedProduct[]> {
  if (slugs.length === 0) return [];
  const options = await listPromoProductOptions();
  return slugs
    .map((slug) => options.find((o) => o.slug === slug))
    .filter((o): o is PromoProductOption => !!o)
    .slice(0, 3);
}
