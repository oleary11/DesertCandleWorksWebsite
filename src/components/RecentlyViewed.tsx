"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getRecentlyViewed, type RecentlyViewedProduct } from "@/lib/recentlyViewed";
import { Clock } from "lucide-react";

type RecentlyViewedProps = {
  currentProductSlug?: string;
  maxProducts?: number;
};

export default function RecentlyViewed({
  currentProductSlug,
  maxProducts = 4
}: RecentlyViewedProps) {
  const [recentProducts, setRecentProducts] = useState<RecentlyViewedProduct[]>([]);

  useEffect(() => {
    const products = getRecentlyViewed()
      .filter(p => p.slug !== currentProductSlug) // Exclude current product
      .slice(0, maxProducts);

    setRecentProducts(products);
  }, [currentProductSlug, maxProducts]);

  if (recentProducts.length === 0) return null;

  return (
    <section className="py-12 px-6 bg-neutral-50/50">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2 mb-8">
          <Clock className="w-5 h-5 text-[var(--color-muted)]" />
          <h2 className="text-2xl font-semibold">Recently Viewed</h2>
        </div>

        <div className="grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {recentProducts.map((product) => (
            <Link
              key={product.slug}
              href={`/shop/${product.slug}`}
              className="group block overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(20,16,12,0.06)] hover:shadow-[0_12px_40px_rgba(20,16,12,0.10)] transition hover:-translate-y-0.5"
            >
              {/* Image */}
              <div className="relative aspect-[4/5] overflow-hidden border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)] border-b-0 rounded-t-2xl bg-transparent">
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover object-center rounded-t-2xl transition-transform duration-500 ease-out group-hover:scale-110"
                    sizes="(min-width:1280px) 260px, (min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
                    quality={75}
                    loading="lazy"
                  />
                )}

                {/* Price pill */}
                <span className="absolute top-3 right-3 px-2.5 py-1 text-xs font-medium rounded-full bg-white/90 backdrop-blur-sm border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)] text-[var(--color-ink)] shadow-sm">
                  ${product.price}
                </span>
              </div>

              {/* Footer */}
              <div className="bg-white border border-t-0 border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)] p-3 rounded-b-2xl">
                <h3 className="text-sm font-medium tracking-tight line-clamp-2 leading-snug min-h-[3em]">
                  {product.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
