"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/products";
import type { ProductVariant } from "@/lib/productsStore";
import type { GlobalScent } from "@/lib/scents";
import QuickAddModal from "./QuickAddModal";

type ProductWithStock = Product & { _computedStock?: number };
type ProductCardProps = {
  product: ProductWithStock;
  compact?: boolean;
  variants?: ProductVariant[];
  globalScents?: GlobalScent[];
};

export default function ProductCard({
  product,
  compact = false,
  variants = [],
  globalScents = [],
}: ProductCardProps) {
  // Use pre-computed stock if available, otherwise fall back to base stock
  const stock = product._computedStock ?? product.stock ?? 0;
  const isLowStock = stock > 0 && stock <= 3;
  const isOutOfStock = stock === 0;
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleClick = () => {
    // Save current scroll position before navigating
    sessionStorage.setItem('shopScrollPosition', window.scrollY.toString());
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowQuickAdd(true);
  };

  return (
    <>
      <Link
        href={`/shop/${product.slug}`}
        onClick={handleClick}
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
          relative aspect-[4/5] overflow-hidden
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
              transition-transform duration-500 ease-out
              group-hover:scale-110
            "
            sizes="(min-width:1280px) 260px, (min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
            quality={75}
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          />
        )}

        {/* Best Seller Badge - positioned to not overlap with price on mobile */}
        {product.bestSeller && (
          <span
            className="
              absolute top-3 left-3
              px-2 py-1 text-[10px] sm:text-xs font-bold
              rounded-full
              bg-gradient-to-r from-amber-500 to-orange-500
              text-white
              shadow-lg
              z-10
              max-w-[calc(100%-5rem)]
            "
          >
            <span className="hidden sm:inline">⭐ Best Seller</span>
            <span className="sm:hidden">⭐ Best</span>
          </span>
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

        {/* Quick Add Button - appears on hover for variant products */}
        {product.variantConfig && variants.length > 0 && (
          <button
            onClick={handleQuickAdd}
            className="
              absolute bottom-3 left-3 right-3
              inline-flex items-center justify-center gap-2
              px-4 py-2 rounded-lg text-sm font-medium
              bg-white text-[var(--color-ink)] shadow-lg
              opacity-0 group-hover:opacity-100
              transition-opacity duration-300 z-20
              hover:bg-neutral-50
            "
            aria-label="Quick add to cart"
          >
            <ShoppingCart className="w-4 h-4" />
            Quick Add
          </button>
        )}
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

      {/* Quick Add Modal */}
      {showQuickAdd && product.variantConfig && (
        <QuickAddModal
          product={product}
          variants={variants}
          globalScents={globalScents}
          wickTypes={product.variantConfig.wickTypes}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </>
  );
}