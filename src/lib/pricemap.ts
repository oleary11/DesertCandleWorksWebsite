import { products } from "@/lib/products";
export const priceToSlug = new Map<string, string>(
  products
    .filter(p => p.stripePriceId)
    .map(p => [p.stripePriceId!, p.slug])
);
