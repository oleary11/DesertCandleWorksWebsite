// app/shop/young-dumb/page.tsx
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import { getAllScents } from "@/lib/scents";
import { getAlcoholTypes } from "@/lib/alcoholTypesStore";
import type { Metadata } from "next";
import type { Product } from "@/lib/products";
import YoungDumbClient from "./YoungDumbClient";

export const revalidate = 30;

type ProductWithStock = Product & { _computedStock: number };

export const generateMetadata = (): Metadata => {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";
  return {
    title: "Young & Dumb Collection | Trendy Candles in Scottsdale, AZ",
    description:
      "Young & Dumb Collection - Hand-poured candles in upcycled liquor bottles with bold, trendy scents. Perfect for dorms, apartments, and Gen Z gift-giving. Made in Scottsdale, Arizona.",
    keywords: [
      "Young & Dumb candles",
      "trendy candles Scottsdale",
      "Gen Z candles",
      "college dorm candles",
      "fun candles Arizona",
      "upcycled bottle candles",
      "liquor bottle candles",
      "apartment candles",
      "unique gift candles",
      "millennial candles",
      "TikTok candles",
      "aesthetic candles",
      "Arizona handmade candles",
      "Scottsdale gifts",
    ],
    alternates: { canonical: `${base}/shop/young-dumb` },
    openGraph: {
      title: "Young & Dumb Collection | Trendy Candles Scottsdale",
      description:
        "Bold, trendy candles in upcycled liquor bottles. Hand-poured in Scottsdale with premium coconut apricot wax and wood wicks. Perfect for dorms, apartments, and unique gifts.",
      url: `${base}/shop/young-dumb`,
      type: "website",
      siteName: "Desert Candle Works",
      images: [{ url: `${base}/images/logo.svg` }],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "Young & Dumb Collection | Desert Candle Works",
      description:
        "Bold, trendy candles in upcycled bottles. Perfect for dorms, apartments, and anyone who loves unique home decor.",
      images: [`${base}/images/logo.svg`],
    },
    robots: { index: true, follow: true },
  };
};

export default async function YoungDumbPage() {
  const [allProducts, globalScents, alcoholTypes] = await Promise.all([
    listResolvedProducts(),
    getAllScents(),
    getAlcoholTypes(),
  ]);

  // Filter for Young & Dumb products only
  const youngDumbProducts = allProducts.filter((p) => p.youngDumb === true);

  const productsWithStock: ProductWithStock[] = await Promise.all(
    youngDumbProducts.map(async (p) => {
      const computedStock = await getTotalStockForProduct(p);
      return { ...p, _computedStock: computedStock };
    })
  );

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

  // Breadcrumb structured data
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: base,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${base}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Young & Dumb Collection",
        item: `${base}/shop/young-dumb`,
      },
    ],
  };

  // Collection page structured data
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Young & Dumb Collection",
    description:
      "Hand-poured candles in upcycled liquor bottles with bold, trendy scents. Perfect for dorms, apartments, and Gen Z gift-giving.",
    url: `${base}/shop/young-dumb`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: youngDumbProducts.length,
      itemListElement: productsWithStock.slice(0, 12).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${base}/shop/${product.slug}`,
        item: {
          "@type": "Product",
          name: product.name,
          description: product.seoDescription,
          image: product.image || `${base}/images/logo.svg`,
          url: `${base}/shop/${product.slug}`,
          brand: {
            "@type": "Brand",
            name: "Desert Candle Works",
          },
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: product.price,
            availability: product._computedStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${base}/shop/${product.slug}`,
          },
        },
      })),
    },
    provider: {
      "@type": "LocalBusiness",
      name: "Desert Candle Works",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Scottsdale",
        addressRegion: "AZ",
        addressCountry: "US",
      },
    },
  };

  return (
    <section className="min-h-dvh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <YoungDumbClient
        products={productsWithStock}
        globalScents={globalScents}
        alcoholTypes={alcoholTypes}
      />
    </section>
  );
}
