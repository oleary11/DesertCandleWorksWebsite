// app/shop/page.tsx
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import { getAllScents } from "@/lib/scents";
import { getAlcoholTypes } from "@/lib/alcoholTypesStore";
import type { Metadata } from "next";
import ShopClient from "./ShopClient";

export const revalidate = 30;

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
      description:
        "Hand-poured soy candles in upcycled bottles. Made in Scottsdale, Arizona with wood wicks and desert-inspired scents.",
      url: `${base}/shop`,
      type: "website",
    },
  };
};

export default async function ShopPage() {
  const [allProducts, globalScents, alcoholTypes] = await Promise.all([
    listResolvedProducts(),
    getAllScents(),
    getAlcoholTypes(),
  ]);

  // Filter out products where visibleOnWebsite is explicitly false
  const visibleProducts = allProducts.filter(p => p.visibleOnWebsite !== false);

  const productsWithStock = await Promise.all(
    visibleProducts.map(async (p) => {
      const computedStock = await getTotalStockForProduct(p);
      return { ...p, _computedStock: computedStock };
    })
  );

  return (
    <section className="min-h-dvh">
      <ShopClient
        products={productsWithStock}
        globalScents={globalScents}
        alcoholTypes={alcoholTypes}
      />
    </section>
  );
}