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
    title: "Shop All-Natural Candles | Scottsdale & Phoenix Clean Burning Soy Coconut Wax Candles",
    description:
      "Shop 100% natural soy coconut wax candles made in Scottsdale, AZ. Clean burning, smokeless, eco-friendly. Upcycled liquor bottle candles with wood wicks. Local Arizona candles, natural gifts, desert scents.",
    keywords: [
      "buy natural candles Scottsdale",
      "soy coconut wax candles Arizona",
      "clean burning candles Phoenix",
      "smokeless candles Arizona",
      "buy candles Scottsdale",
      "candles Phoenix Arizona",
      "handmade candles near me",
      "local candles Scottsdale",
      "all-natural candles Arizona",
      "wood wick candles",
      "upcycled bottle candles",
      "eco-friendly candles",
      "sustainable candles Arizona",
      "non-toxic candles Scottsdale",
      "Arizona gifts",
    ],
    alternates: { canonical: `${base}/shop` },
    openGraph: {
      title: "Shop All-Natural Candles | Scottsdale Clean Burning Soy Coconut Wax Candles",
      description:
        "100% natural soy coconut wax candles in upcycled bottles. Clean burning, smokeless, eco-friendly. Made in Scottsdale, Arizona with wood wicks and desert-inspired scents.",
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