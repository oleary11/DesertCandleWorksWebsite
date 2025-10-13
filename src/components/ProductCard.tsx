import Image from "next/image";
import Link from "next/link";

export default function ProductCard({
  product,
  compact = false,
}: { product: any; compact?: boolean }) {
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
            alt={product.name}
            fill
            className="
              object-cover object-center rounded-t-2xl
              transition-transform duration-300 ease-out
              group-hover:scale-[1.03]
            "
            sizes="(min-width:1280px) 260px, (min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
            quality={90}
          />
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