"use client";

import ProductCard from "./ProductCard";
import type { Product } from "@/lib/products";

type RelatedProductsProps = {
  currentProductSlug: string;
  products: (Product & { _computedStock: number })[];
  maxProducts?: number;
};

export default function RelatedProducts({
  currentProductSlug,
  products,
  maxProducts = 4
}: RelatedProductsProps) {
  // Filter out current product and get random related products
  const relatedProducts = products
    .filter(p => p.slug !== currentProductSlug)
    .sort(() => Math.random() - 0.5) // Shuffle
    .slice(0, maxProducts);

  if (relatedProducts.length === 0) return null;

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">You Might Also Like</h2>
        </div>

        <div className="grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {relatedProducts.map((product) => (
            <ProductCard key={product.slug} product={product} compact />
          ))}
        </div>
      </div>
    </section>
  );
}
