import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";

type ProductWithStock = Product & { _computedStock?: number };
type ProductCardProps = { product: ProductWithStock; compact?: boolean };

export default function ProductCard({product, compact = false, }: ProductCardProps) {
  // Use pre-computed stock if available, otherwise fall back to base stock
  const stock = product._computedStock ?? product.stock ?? 0;
  const isLowStock = stock > 0 && stock <= 3;
  const isOutOfStock = stock === 0;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="
        group block overflow-hidden rounded-2xl bg-transparent
        shadow-[0_8px_30px_rgba(20,16,12,0.06)]
        hover:shadow-[0_12px_40px_rgba(20,16,12,0.10)]
        transition hover:-translate-y-0.5
      "
    >
      {/* IMAGE ZONE (cropped look) */}
      <div
        className="
          relative aspect-[4/5]
          border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]
          border-b-0 rounded-t-2xl bg-transparent
        "
      >
        {product.image && (
          <Image
            src={product.image}
            alt={`${product.name} - Handmade soy candle in upcycled liquor bottle`}
            fill
            className="
              object-cover object-center rounded-t-2xl
              transition-transform duration-300 ease-out
              group-hover:scale-[1.03]
            "
            sizes="(min-width:1280px) 260px, (min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
            quality={75}
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          />
        )}

        {/* Stock status badge - positioned to not overlap price */}
        {isOutOfStock && (
          <span
            className="
              absolute bottom-3 left-3
              px-2.5 py-1 text-xs font-medium
              rounded-full
              bg-neutral-800/90 backdrop-blur-sm
              text-white
              shadow-sm
            "
          >
            Out of Stock
          </span>
        )}
        {isLowStock && (
          <span
            className="
              absolute bottom-3 left-3
              px-2.5 py-1 text-xs font-medium
              rounded-full
              bg-amber-500/90 backdrop-blur-sm
              text-white
              shadow-sm
            "
          >
            Only {stock} left
          </span>
        )}

        {/* Price pill in top-right corner */}
        <span
          className="
            absolute top-3 right-3
            px-2.5 py-1 text-xs font-medium
            rounded-full
            bg-white/90 backdrop-blur-sm
            border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]
            text-[var(--color-ink)]
            shadow-sm
          "
        >
          ${product.price}
        </span>
      </div>

      {/* FOOTER (white info strip) */}
      <div
        className={`
          bg-white border border-t-0
          border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]
          ${compact ? "p-3" : "p-4"}
          rounded-b-2xl
        `}
      >
      <h3
        className={`
          ${compact ? "text-sm" : "text-base"}
          font-medium tracking-tight
          line-clamp-2 leading-snug min-h-[3em]
        `}
      >
        {product.name}
      </h3>
      </div>
    </Link>
  );
}