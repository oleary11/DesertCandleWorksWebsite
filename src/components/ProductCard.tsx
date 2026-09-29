"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import type { Product } from "@/lib/products";
import { getPrimaryImage } from "@/lib/products";
import type { ProductVariant } from "@/lib/productsStore";
import type { GlobalScent } from "@/lib/scents";
import QuickAddModal from "./QuickAddModal";
import HomeGoodsQuickAddModal from "./HomeGoodsQuickAddModal";
import RestockRequestDialog from "./shop/RestockRequestDialog";
import type { BottlePickerOption } from "@/app/shop/[slug]/HomeGoodsBottlePicker";
import { serif } from "@/lib/storefrontFonts";

type ProductWithStock = Product & { _computedStock?: number };
type ProductCardProps = {
  product: ProductWithStock;
  compact?: boolean;
  variants?: ProductVariant[];
  globalScents?: GlobalScent[];
  homeGoodsBottles?: BottlePickerOption[];
};

export default function ProductCard({
  product,
  compact = false,
  variants = [],
  globalScents = [],
  homeGoodsBottles = [],
}: ProductCardProps) {
  // Pre-computed stock when available, otherwise base stock.
  const stock = product._computedStock ?? product.stock ?? 0;
  const isLowStock = stock === 1;
  const isOutOfStock = stock === 0;
  const isHomeGoods = product.productType === "home_goods";
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const canQuickAdd =
    !isOutOfStock && ((isHomeGoods && homeGoodsBottles.length > 0) || (!!product.variantConfig && variants.length > 0));
  const image = getPrimaryImage(product);
  const fromPrice = isHomeGoods && homeGoodsBottles.length > 0
    ? Math.min(...homeGoodsBottles.filter((b) => b.stock > 0).map((b) => b.priceCents), Math.round(product.price * 100)) / 100
    : product.price;
  const showsFrom = isHomeGoods
    ? homeGoodsBottles.some((b) => b.priceCents / 100 !== fromPrice)
    : (product.variantConfig?.sizes?.length ?? 0) > 1;

  // Remember where we were so "back to shop" can restore the scroll position.
  const rememberScroll = () => sessionStorage.setItem("shopScrollPosition", window.scrollY.toString());

  return (
    <>
      <article className="s-ui group relative flex h-full flex-col">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#efe3d6] shadow-[0_1px_2px_rgb(63_42_33/0.06),0_14px_30px_-18px_rgb(63_42_33/0.35)]">
          {/* Duplicate of the title link below, for pointer users; hidden from keyboard and screen readers. */}
          <Link href={`/shop/${product.slug}`} onClick={rememberScroll} tabIndex={-1} aria-hidden className="absolute inset-0">
            {image ? (
              <Image
                src={image}
                alt=""
                fill
                className={`object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04] ${isOutOfStock ? "opacity-60 saturate-[.6]" : ""}`}
                sizes="(min-width:1280px) 280px, (min-width:1024px) 22vw, (min-width:640px) 30vw, 46vw"
                quality={75}
                loading="lazy"
              />
            ) : null}
          </Link>

          {(isOutOfStock || isLowStock) && (
            <span
              className={`pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                isOutOfStock ? "bg-[#fbf6f0]/95 text-[#74594b]" : "bg-[#a9502f] text-white"
              }`}
            >
              {isOutOfStock ? "Sold out" : "Only 1 left"}
            </span>
          )}

          {(canQuickAdd || isOutOfStock) && (
            <button
              type="button"
              onClick={() => (canQuickAdd ? setShowQuickAdd(true) : setShowRequest(true))}
              aria-label={canQuickAdd ? `Quick add ${product.name}` : `Get notified when ${product.name} is back`}
              className="absolute bottom-2.5 right-2.5 flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-white/95 px-2.5 text-sm font-semibold text-[#3f2a21] shadow-[0_6px_16px_-6px_rgb(63_42_33/0.45)] backdrop-blur transition-colors hover:bg-[#3f2a21] hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9502f] sm:px-3.5"
            >
              {canQuickAdd ? <Plus className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
              <span className={compact ? "hidden sm:inline" : ""}>{canQuickAdd ? "Add" : "Notify me"}</span>
            </button>
          )}
        </div>

        <Link
          href={`/shop/${product.slug}`}
          onClick={rememberScroll}
          className={`block rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9502f] ${compact ? "pt-3" : "pt-4"}`}
        >
          <h3
            className={`${serif.className} line-clamp-2 leading-snug text-[#3f2a21] ${compact ? "text-[15px] sm:text-base" : "text-lg"} group-hover:underline group-hover:decoration-[#a9502f]/40 group-hover:underline-offset-4`}
          >
            {product.name}
          </h3>
          <p className="mt-1 text-sm tabular-nums text-[#74594b]">
            {showsFrom && <span className="text-xs">from </span>}
            <span className="font-semibold text-[#3f2a21]">${fromPrice.toFixed(2)}</span>
            {isOutOfStock && <span className="sr-only"> (sold out)</span>}
          </p>
        </Link>
      </article>

      {showQuickAdd && isHomeGoods && (
        <HomeGoodsQuickAddModal
          productSlug={product.slug}
          productName={product.name}
          bottles={homeGoodsBottles}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
      {showQuickAdd && !isHomeGoods && product.variantConfig && (
        <QuickAddModal product={product} variants={variants} globalScents={globalScents} onClose={() => setShowQuickAdd(false)} />
      )}
      {showRequest && (
        <RestockRequestDialog
          productName={product.name}
          wickTypes={product.variantConfig?.wickTypes}
          scents={globalScents}
          onClose={() => setShowRequest(false)}
        />
      )}
    </>
  );
}
