// app/shop/page.tsx
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getAllScents } from "@/lib/scents";
import { getAlcoholTypes } from "@/lib/alcoholTypesStore";
import type { Metadata } from "next";
import ShopClient from "./ShopClient";

export const revalidate = 30;

export const generateMetadata = (): Metadata => {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";
  return {
    title: "Shop All-Natural Candles | Scottsdale & Phoenix Clean Burning Coconut Apricot Wax Candles",
    description:
      "Shop 100% natural coconut apricot wax candles made in Scottsdale, AZ. Clean burning, smokeless, eco-friendly. Upcycled liquor bottle candles with wood wicks. Local Arizona candles, natural gifts, desert scents.",
    keywords: [
      "buy natural candles Scottsdale",
      "coconut apricot wax candles Arizona",
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
      title: "Shop All-Natural Candles | Scottsdale Clean Burning Coconut Apricot Wax Candles",
      description:
        "100% natural coconut apricot wax candles in upcycled bottles. Clean burning, smokeless, eco-friendly. Made in Scottsdale, Arizona with wood wicks and desert-inspired scents.",
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

  // Optimize: Fetch scents for all products in parallel, then calculate stock synchronously
  const { getScentsForProduct } = await import("@/lib/scents");
  const { getTotalStock } = await import("@/lib/productsStore");

  // Fetch all product scents in parallel (single batch operation)
  const productScentsMap = new Map<string, Awaited<ReturnType<typeof getScentsForProduct>>>();
  await Promise.all(
    visibleProducts.map(async (p) => {
      if (p.variantConfig) {
        const scents = await getScentsForProduct(p.slug);
        productScentsMap.set(p.slug, scents);
      }
    })
  );

  // Calculate stock synchronously using cached scent data
  const productsWithStock = visibleProducts.map((p) => {
    let computedStock: number;

    if (!p.variantConfig) {
      computedStock = p.stock ?? 0;
    } else {
      const allowedScents = productScentsMap.get(p.slug);

      // Fallback to total stock if no scents found
      if (!allowedScents || allowedScents.length === 0) {
        computedStock = getTotalStock(p);
      } else {
        const allowedScentIds = new Set(allowedScents.map(s => s.id));
        const { variantData, wickTypes } = p.variantConfig;
        const wickIds = new Set(wickTypes.map(w => w.id));

        let total = 0;
        for (const [variantId, data] of Object.entries(variantData)) {
          // Variant ID format: [sizeId-]wickTypeId-scentId
          // Extract scent ID by removing size and wick prefixes
          let remainingId = variantId;

          // Remove size prefix if present (format: size-{timestamp}-)
          if (remainingId.startsWith('size-')) {
            const sizeEndIndex = remainingId.indexOf('-', 5); // Find second hyphen
            if (sizeEndIndex !== -1) {
              remainingId = remainingId.substring(sizeEndIndex + 1);
            }
          }

          // Remove wick type prefix
          let scentId = remainingId;
          for (const wickId of wickIds) {
            if (remainingId.startsWith(wickId + '-')) {
              scentId = remainingId.substring(wickId.length + 1);
              break;
            }
          }

          if (allowedScentIds.has(scentId)) {
            total += data.stock ?? 0;
          }
        }
        computedStock = total;
      }
    }

    return { ...p, _computedStock: computedStock };
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

  // CollectionPage schema for better Google Shopping integration
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${base}/shop#collection`,
    name: "All-Natural Candles | Desert Candle Works Shop",
    description: "Shop our collection of 100% natural coconut apricot wax candles in upcycled liquor bottles. Clean burning, smokeless, eco-friendly candles made in Scottsdale, Arizona.",
    url: `${base}/shop`,
    isPartOf: {
      "@id": `${base}#website`,
    },
    about: {
      "@type": "Thing",
      name: "Natural Candles",
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: productsWithStock.length,
      itemListElement: productsWithStock.slice(0, 10).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.name,
          url: `${base}/shop/${product.slug}`,
          image: product.image || `${base}/images/placeholder.png`,
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: product.price,
            availability: product._computedStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        },
      })),
    },
  };

  return (
    <section className="min-h-dvh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <ShopClient
        products={productsWithStock}
        globalScents={globalScents}
        alcoholTypes={alcoholTypes}
      />
    </section>
  );
}