import ProductCard from "@/components/ProductCard";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import type { Metadata } from "next";
export const revalidate = 3600;

export const generateMetadata = (): Metadata => {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";
  return {
    title: "Shop Local Candles | Scottsdale & Phoenix Handmade Soy Candles",
    description:
      "Shop hand-poured soy candles made in Scottsdale, AZ. Upcycled liquor bottle candles with wood wicks. Local Arizona candles, eco-friendly gifts, desert scents.",
    keywords: [
      "buy candles Scottsdale",
      "candles Phoenix Arizona",
      "handmade candles near me",
      "local candles Scottsdale",
      "soy candles Arizona",
      "wood wick candles",
      "upcycled bottle candles",
      "eco-friendly candles",
      "Arizona gifts",
    ],
    alternates: { canonical: `${base}/shop` },
    openGraph: {
      title: "Shop Local Candles | Scottsdale & Phoenix Handmade Soy Candles",
      description: "Hand-poured soy candles in upcycled bottles. Made in Scottsdale, Arizona with wood wicks and desert-inspired scents.",
      url: `${base}/shop`,
      type: "website",
    },
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
          <h1>Shop Scottsdale Candles</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            Hand-poured soy candles made locally in Arizona. Upcycled bottles, wood wicks, and desert-inspired scents.
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