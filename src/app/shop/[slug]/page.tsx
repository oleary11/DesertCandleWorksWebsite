import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedProduct } from "@/lib/liveProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import { generateVariants, getAllImages } from "@/lib/products";
import { getScentsForProduct } from "@/lib/scents";
import ProductVariantForm from "./ProductVariantForm";
import ProductActions from "./ProductActions";
import HomeGoodsBottlePicker, { type BottlePickerOption } from "./HomeGoodsBottlePicker";
import ProductBreadcrumbs from "@/components/ProductBreadcrumbs";
import RecentlyViewed from "@/components/RecentlyViewed";
import ProductPageTracker from "@/components/ProductPageTracker";
import ShareButtons from "@/components/ShareButtons";
import ProductImageGallery from "./ProductImageGallery";
import GoogleReviews from "@/components/GoogleReviews";
import s from "@/components/home/home.module.css";
import { serif } from "@/lib/storefrontFonts";
import { CANDLE_DETAILS, HOME_GOODS_DETAILS } from "@/components/shop/productDetails";

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

  let stock: number;
  let homeGoodsBottles: BottlePickerOption[] = [];
  if (p.productType === "home_goods") {
    const { computeHomeGoodsStock, getBottleInventoryById, getSingleBottleStock } = await import("@/lib/bottleInventoryStore");
    const { getAlcoholTypes } = await import("@/lib/alcoholTypesStore");
    const [bottleById, alcoholTypes] = await Promise.all([getBottleInventoryById(), getAlcoholTypes()]);
    stock = computeHomeGoodsStock(p, bottleById);
    const typeSortOrder = new Map(alcoholTypes.map((t) => [t.name, t.sortOrder ?? 9999]));
    homeGoodsBottles = (p.bottleOptions || [])
      .map((opt) => {
        const b = bottleById.get(opt.bottleId);
        return {
          bottleId: opt.bottleId,
          name: b?.name ?? opt.bottleName,
          imageUrl: b?.imageUrl,
          priceCents: opt.priceCents ?? Math.round(p.price * 100),
          stock: b ? getSingleBottleStock(b, p.requiresUncut) : 0,
          alcoholType: b?.alcoholType,
        };
      })
      .sort((a, b) => {
        const orderDiff = (typeSortOrder.get(a.alcoholType || "") ?? 9999) - (typeSortOrder.get(b.alcoholType || "") ?? 9999);
        return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
      });
  } else {
    stock = await getTotalStockForProduct(p);
  }
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

  // Calculate price valid date (1 year from now)
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${base}/shop/${p.slug}#product`,
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
      priceValidUntil,
      itemCondition: "https://schema.org/NewCondition",
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
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "US",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
            unitCode: "d",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 3,
            maxValue: 7,
            unitCode: "d",
          },
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
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Wax Type",
        value: "100% Natural Coconut Apricot Wax",
      },
      {
        "@type": "PropertyValue",
        name: "Container",
        value: "Upcycled Liquor Bottle",
      },
      {
        "@type": "PropertyValue",
        name: "Made In",
        value: "Scottsdale, Arizona",
      },
    ],
  };

  const isHomeGoods = p.productType === "home_goods";
  const details = isHomeGoods ? HOME_GOODS_DETAILS : CANDLE_DETAILS;

  return (
    <div className={`${s.page} s-ui`}>
      <section className={`${s.cream} px-6 pb-32 pt-6 md:pb-20`}>
        <div className="mx-auto mb-6 max-w-7xl">
          <ProductBreadcrumbs productName={p.name} />
        </div>

        <article className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <ProductImageGallery images={productImages} productName={p.name} />
          </div>

          <div className="lg:col-span-5">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--home-clay)]">
              {isHomeGoods ? "Home goods" : p.alcoholType || "Candle"}
            </p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className={`${serif.className} text-balance text-[2.1rem] leading-[1.12] text-[var(--home-ink)] sm:text-[2.6rem]`}>
                {p.name}
              </h1>
              <div className="shrink-0 pt-1">
                <ShareButtons productName={p.name} productSlug={p.slug} />
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-[var(--home-muted)]">{p.seoDescription}</p>

            <div className="mt-8">
              {isHomeGoods ? (
                <HomeGoodsBottlePicker productSlug={p.slug} productName={p.name} bottles={homeGoodsBottles} />
              ) : p.variantConfig && globalScents.length > 0 ? (
                <ProductVariantForm product={p} variants={variants} globalScents={globalScents} variantConfig={p.variantConfig} />
              ) : p.variantConfig ? (
                <p className="rounded-2xl bg-[var(--home-peach)] px-5 py-4 text-[15px] text-[var(--home-ink)]">
                  <span className="font-semibold">Scents are on their way.</span> Get in touch and we&apos;ll let you know when this one is ready.
                </p>
              ) : (
                <ProductActions product={p} stock={stock} />
              )}
            </div>

            <div className="mt-10 divide-y divide-[var(--home-line)] border-y border-[var(--home-line)]">
              {details.map((section) => (
                <details key={section.title} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-[var(--home-ink)] [&::-webkit-details-marker]:hidden">
                    {section.title}
                    <span className="text-xl font-normal leading-none text-[var(--home-muted)] transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <ul className="space-y-2 pb-5 text-[15px] leading-relaxed text-[var(--home-muted)]">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--home-clay)]" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>

          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        </article>
      </section>

      <section className={`${s.paper} ${s.tornTop} px-6 py-16`}>
        <div className="mx-auto max-w-7xl">
          <GoogleReviews maxReviews={3} />
        </div>
      </section>

      <ProductPageTracker product={p} />

      <div className={s.cream}>
        <RecentlyViewed currentProductSlug={p.slug} maxProducts={4} />
      </div>
    </div>
  );
}
