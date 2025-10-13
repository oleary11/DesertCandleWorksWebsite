import Image from "next/image";
import type { Metadata } from "next";
import { getResolvedProduct } from "@/lib/liveProducts";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getResolvedProduct(slug);
  if (!p) return { title: "Not found" };
  return {
    title: p.name,
    description: p.seoDescription,
    alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || "https://example.com"}/shop/${p.slug}` },
    openGraph: {
      title: p.name,
      description: p.seoDescription,
      images: p.image ? [{ url: p.image }] : [],
    },
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://example.com"),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getResolvedProduct(slug);
  if (!p) return <div className="py-20">Not found</div>;

  const stock = p.stock ?? 0;
  const availability = stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

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
      url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://example.com"}/shop/${p.slug}`,
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
          <p className="mt-2 text-sm">
            {stock <= 0 ? (
              <span className="text-rose-600 font-medium">Out of stock</span>
            ) : stock < 3 ? (
              <span className="text-rose-600 font-medium">Only {stock} left — almost gone</span>
            ) : (
              <span className="text-[var(--color-muted)]">{stock} in stock</span>
            )}
          </p>

          <form className="mt-6" action="/api/checkout" method="post">
            <input
              type="hidden"
              name="lineItems"
              value={JSON.stringify([{ price: p.stripePriceId, quantity: 1 }])}
            />
            <button
              type="submit"
              disabled={!p.stripePriceId || stock <= 0}
              className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium border-0 cursor-pointer
              [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
              text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
              hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
              ${stock <= 0 ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
            >
              {stock <= 0 ? "Out of stock" : "Buy now"}
            </button>
          </form>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </article>
    </section>
  );
}