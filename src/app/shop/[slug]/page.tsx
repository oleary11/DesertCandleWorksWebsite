import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedProduct } from "@/lib/liveProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import { generateVariants, getAllImages } from "@/lib/products";
import { getScentsForProduct } from "@/lib/scents";
import ProductVariantForm from "./ProductVariantForm";
import ProductActions from "./ProductActions";
import ProductBreadcrumbs from "@/components/ProductBreadcrumbs";
import RecentlyViewed from "@/components/RecentlyViewed";
import ProductPageTracker from "@/components/ProductPageTracker";
import ShareButtons from "@/components/ShareButtons";
import ProductImageGallery from "./ProductImageGallery";

// Cache product pages for 1 minute in production
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getResolvedProduct(slug);
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

  if (!p) return { title: "Not found" };

  const images = getAllImages(p);
  const primaryImage = images[0];

  return {
    title: `${p.name} | Scottsdale Handmade Candles`,
    description: `${p.seoDescription} Hand-poured in Scottsdale, AZ. Premium coconut apricot wax, wood wicks, and upcycled bottles. Shop local Arizona candles.`,
    keywords: [
      p.name,
      "Scottsdale candles",
      "Arizona candles",
      "handmade candles",
      "coconut apricot candles",
      "wood wick candles",
      "upcycled bottle candles",
      "local candles",
    ],
    alternates: { canonical: `${base}/shop/${p.slug}` },
    openGraph: {
      title: `${p.name} | Scottsdale Handmade Candles`,
      description: `${p.seoDescription} Made in Scottsdale, Arizona.`,
      images: primaryImage ? [{ url: primaryImage, width: 1200, height: 630 }] : [],
      type: "website",
      url: `${base}/shop/${p.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${p.name} | Desert Candle Works`,
      description: p.seoDescription,
      images: primaryImage ? [primaryImage] : [],
    },
    metadataBase: new URL(base),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getResolvedProduct(slug);
  if (!p) notFound();

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

  const productImages = getAllImages(p);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: productImages.length > 0 ? productImages : [],
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
    material: "Coconut apricot wax",
    category: "Home & Garden > Candles",
  };

  return (
    <section className="pt-6 md:pt-8 px-6">
      <div className="mx-auto max-w-6xl mb-6">
        <ProductBreadcrumbs productName={p.name} />
      </div>

      <article className="mx-auto max-w-6xl grid gap-8 md:gap-10 md:grid-cols-2 items-start pb-14">
        <ProductImageGallery images={getAllImages(p)} productName={p.name} />

        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight flex-1">{p.name}</h1>
            <ShareButtons productName={p.name} productSlug={p.slug} />
          </div>
          <p className="mt-2 md:mt-3 text-sm md:text-base text-[var(--color-muted)] whitespace-pre-line">{p.seoDescription}</p>
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

      {/* Product page tracker - tracks view in localStorage */}
      <ProductPageTracker product={p} />

      {/* Recently Viewed */}
      <RecentlyViewed currentProductSlug={p.slug} maxProducts={4} />
    </section>
  );
}