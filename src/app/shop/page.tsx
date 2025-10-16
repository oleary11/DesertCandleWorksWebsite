import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import { getAllScents } from "@/lib/scents";
import type { Metadata } from "next";
import ShopClient from "./ShopClient";
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
  const globalScents = await getAllScents();

  // Compute stock for each product (filtering experimental scents)
  const productsWithStock = await Promise.all(
    products.map(async (p) => {
      const computedStock = await getTotalStockForProduct(p);

      return {
        ...p,
        _computedStock: computedStock,
      };
    })
  );

  return (
    <section className="min-h-dvh">
      <ShopClient products={productsWithStock} globalScents={globalScents} />
    </section>
  );
}