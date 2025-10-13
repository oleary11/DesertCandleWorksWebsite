import ProductCard from "@/components/ProductCard";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import type { Metadata } from "next";
export const revalidate = 3600;

export const generateMetadata = (): Metadata => {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";
  return {
    title: "Shop Upcycled Bottle Candles",
    description:
      "Browse small-batch soy candles poured into upcycled whiskey, tequila, and gin bottles.",
    alternates: { canonical: `${base}/shop` },
  };
};

export default async function ShopPage() {
  const products = await listResolvedProducts();

  return (
    <section className="min-h-dvh">
      {/* Full-bleed header strip */}
      <div className="full-bleed relative isolate py-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-[2px]" />
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h1>Shop</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            Hand-poured, upcycled-bottle candles — curated bestsellers and new arrivals.
          </p>
        </div>
      </div>

      {/* Product grid (smaller, denser) */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-8 grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} compact />
          ))}
        </div>
      </div>
    </section>
  );
}