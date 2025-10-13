// app/shop/[slug]/page.tsx
import Image from "next/image";
import type { Metadata } from "next";
import { getProduct } from "@/lib/products";

// NOTE: params is a Promise now
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;                // ← await
  const p = getProduct(slug)!;

  return {
    title: p.name,
    description: p.seoDescription,
    alternates: { canonical: `https://example.com/shop/${p.slug}` },
    openGraph: {
      title: p.name,
      description: p.seoDescription,
      images: p.image ? [{ url: p.image }] : [],
    },
    // (Optional but recommended) so OG URLs resolve correctly in prod:
    metadataBase: new URL("https://example.com"),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;                // ← await
  const p = getProduct(slug);
  if (!p) return <div className="py-20">Not found</div>;

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
      availability: "https://schema.org/InStock",
      url: `https://example.com/shop/${p.slug}`,
    },
  };

  return (
    <section className="pt-8 md:pt-12">
      <article className="mx-auto max-w-6xl grid gap-10 md:grid-cols-2 items-start pb-14">
        <div className="relative w-full aspect-[4/5] md:aspect-[3/4] max-h-[56svh] md:max-h-[60svh] overflow-hidden">
          {p.image && (
            <Image
              src={p.image}
              alt={p.name}
              fill
              className="object-contain"
              sizes="(min-width: 1024px) 540px, 90vw"
              quality={90}
              priority
            />
          )}
        </div>

        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{p.name}</h1>
          <p className="mt-3 text-base text-[var(--color-muted)]">{p.seoDescription}</p>
          <p className="mt-6 text-xl font-medium">${p.price}</p>

          <form className="mt-8" action="/api/checkout" method="post">
            <input
              type="hidden"
              name="lineItems"
              value={JSON.stringify([{ price: p.stripePriceId, quantity: 1 }])}
            />
            <button
              type="submit"
              className="
                inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
                text-[var(--color-accent-ink)] border-0
                [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                shadow-[0_2px_10px_rgba(20,16,12,0.1)]
                hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)]
                hover:-translate-y-[1px] transition
              "
            >
              Buy now
            </button>
          </form>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </article>
    </section>
  );
}