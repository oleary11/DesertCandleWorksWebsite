import Image from "next/image";
import type { Metadata } from "next";
import { getResolvedProduct } from "@/lib/liveProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import { generateVariants } from "@/lib/products";
import { getScentsForProduct } from "@/lib/scents";
import ProductVariantForm from "./ProductVariantForm";
import ProductActions from "./ProductActions";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getResolvedProduct(slug);
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

  if (!p) return { title: "Not found" };

  return {
    title: `${p.name} | Scottsdale Handmade Candles`,
    description: `${p.seoDescription} Hand-poured in Scottsdale, AZ. Premium soy wax, wood wicks, and upcycled bottles. Shop local Arizona candles.`,
    keywords: [
      p.name,
      "Scottsdale candles",
      "Arizona candles",
      "handmade candles",
      "soy candles",
      "wood wick candles",
      "upcycled bottle candles",
      "local candles",
    ],
    alternates: { canonical: `${base}/shop/${p.slug}` },
    openGraph: {
      title: `${p.name} | Scottsdale Handmade Candles`,
      description: `${p.seoDescription} Made in Scottsdale, Arizona.`,
      images: p.image ? [{ url: p.image, width: 1200, height: 630 }] : [],
      type: "website",
      url: `${base}/shop/${p.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${p.name} | Desert Candle Works`,
      description: p.seoDescription,
      images: p.image ? [p.image] : [],
    },
    metadataBase: new URL(base),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getResolvedProduct(slug);
  if (!p) return <div className="py-20">Not found</div>;

  // Get global scents for this product
  const globalScents = p.variantConfig ? await getScentsForProduct(slug) : [];

  const stock = await getTotalStockForProduct(p);
  const variants = p.variantConfig ? generateVariants(p, globalScents) : [];
  const availability = stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

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
        name: p.name,
        item: `${base}/shop/${p.slug}`,
      },
    ],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.image ? [p.image] : [],
    description: p.seoDescription,
    sku: p.sku,
    brand: { "@type": "Brand", name: "Desert Candle Works" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: p.price,
      availability,
      url: `${base}/shop/${p.slug}`,
      seller: {
        "@type": "Organization",
        name: "Desert Candle Works",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Scottsdale",
          addressRegion: "AZ",
          addressCountry: "US",
        },
      },
    },
    manufacturer: {
      "@type": "Organization",
      name: "Desert Candle Works",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Scottsdale",
        addressRegion: "AZ",
        addressCountry: "US",
      },
    },
    material: "Soy wax",
    category: "Home & Garden > Candles",
  };

  return (
    <section className="pt-8 md:pt-12 px-6">
      <article className="mx-auto max-w-6xl grid gap-8 md:gap-10 md:grid-cols-2 items-start pb-14">
        <div className="relative w-full aspect-[4/5] md:aspect-[3/4] max-h-[56svh] md:max-h-[60svh] overflow-hidden rounded-lg md:rounded-xl">
          {p.image && (
            <Image
              src={p.image}
              alt={`${p.name} - Hand-poured soy candle in upcycled liquor bottle`}
              fill
              className="object-contain"
              sizes="(min-width: 1024px) 540px, 90vw"
              quality={90}
              priority
            />
          )}
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{p.name}</h1>
          <p className="mt-2 md:mt-3 text-sm md:text-base text-[var(--color-muted)]">{p.seoDescription}</p>
          <p className="mt-4 md:mt-6 text-xl font-medium">${p.price}</p>

          {p.variantConfig && globalScents.length > 0 ? (
            <ProductVariantForm product={p} variants={variants} globalScents={globalScents} variantConfig={p.variantConfig} />
          ) : p.variantConfig && globalScents.length === 0 ? (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900">
                <strong>No scents available yet.</strong> Please contact us to set up scents for this product.
              </p>
            </div>
          ) : (
            <ProductActions
              product={p}
              stock={stock}
            />
          )}
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </article>
    </section>
  );
}