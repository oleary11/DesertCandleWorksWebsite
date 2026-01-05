"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/products";
import { getPrimaryImage } from "@/lib/products";
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
  const isLowStock = stock === 1;
  const isOutOfStock = stock === 0;
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestWickType, setRequestWickType] = useState("");
  const [requestScent, setRequestScent] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [requestMessage, setRequestMessage] = useState("");

  const handleClick = () => {
    // Save current scroll position before navigating
    sessionStorage.setItem('shopScrollPosition', window.scrollY.toString());
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowQuickAdd(true);
  };

  const handleRequest = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowRequestModal(true);
  };

  const handleRequestScent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestStatus("loading");

    try {
      const res = await fetch("/api/request-scent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: requestEmail,
          productName: product.name,
          wickType: requestWickType || "Any",
          scent: requestScent || "Any available scent",
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setRequestStatus("success");
        setRequestMessage(data.message || "Request submitted successfully!");
        setTimeout(() => {
          setShowRequestModal(false);
          setRequestEmail("");
          setRequestWickType("");
          setRequestScent("");
          setRequestStatus("idle");
          setRequestMessage("");
        }, 3000);
      } else {
        setRequestStatus("error");
        setRequestMessage(data.error || "Failed to submit request.");
      }
    } catch {
      setRequestStatus("error");
      setRequestMessage("Network error. Please try again.");
    }
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
          relative
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
        {(() => {
          const primaryImage = getPrimaryImage(product);
          return primaryImage ? (
            <Image
              src={primaryImage}
              alt={`${product.name} - Handmade coconut apricot candle in upcycled liquor bottle`}
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
          ) : null;
        })()}

        {/* Out of stock overlay - only on image */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-neutral-400/70 rounded-t-2xl" />
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

        {/* Quick Add / Request Button - compact icon on mobile, full button on desktop hover */}
        {isOutOfStock ? (
          <button
            onClick={handleRequest}
            className="
              absolute bottom-3 right-3
              inline-flex items-center justify-center gap-2
              rounded-lg font-medium
              bg-white text-[var(--color-ink)] shadow-lg
              transition-all duration-300 z-20
              hover:bg-neutral-50
              w-10 h-10 md:w-auto md:h-auto
              md:px-4 md:py-2 md:left-3 md:right-3
              md:opacity-0 md:group-hover:opacity-100
            "
            aria-label="Request notification"
          >
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="hidden md:inline text-sm">Request</span>
          </button>
        ) : product.variantConfig && variants.length > 0 ? (
          <button
            onClick={handleQuickAdd}
            className="
              absolute bottom-3 right-3
              inline-flex items-center justify-center gap-2
              rounded-lg font-medium
              bg-white text-[var(--color-ink)] shadow-lg
              transition-all duration-300 z-20
              hover:bg-neutral-50
              w-10 h-10 md:w-auto md:h-auto
              md:px-4 md:py-2 md:left-3 md:right-3
              md:opacity-0 md:group-hover:opacity-100
            "
            aria-label="Quick add to cart"
          >
            <ShoppingCart className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline text-sm">Quick Add</span>
          </button>
        ) : null}
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

      {/* Request Scent Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (requestStatus !== "loading") {
                setShowRequestModal(false);
                setRequestEmail("");
                setRequestStatus("idle");
                setRequestMessage("");
              }
            }}
          />

          {/* Modal */}
          <div className="relative card max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Request Restock Notification</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              {product.name}
            </p>

            {requestStatus === "success" ? (
              <div className="text-sm text-green-600 dark:text-green-400">
                {requestMessage}
              </div>
            ) : (
              <form onSubmit={handleRequestScent} className="space-y-4">
                {/* Wick Type Selector (if product has variant config) */}
                {product.variantConfig && product.variantConfig.wickTypes.length > 0 && (
                  <div>
                    <label htmlFor="request-wick" className="block text-sm font-medium mb-1">
                      Wick Type (Optional)
                    </label>
                    <select
                      id="request-wick"
                      value={requestWickType}
                      onChange={(e) => setRequestWickType(e.target.value)}
                      className="input w-full"
                      disabled={requestStatus === "loading"}
                    >
                      <option value="">Any wick type</option>
                      {product.variantConfig.wickTypes.map((wick) => (
                        <option key={wick.id} value={wick.name}>
                          {wick.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scent Selector (if global scents available) */}
                {globalScents.filter(s => !s.limited).length > 0 && (
                  <div>
                    <label htmlFor="request-scent" className="block text-sm font-medium mb-1">
                      Scent (Optional)
                    </label>
                    <select
                      id="request-scent"
                      value={requestScent}
                      onChange={(e) => setRequestScent(e.target.value)}
                      className="input w-full"
                      disabled={requestStatus === "loading"}
                    >
                      <option value="">Any scent</option>
                      {globalScents
                        .filter(scent => !scent.limited)
                        .map((scent) => (
                          <option key={scent.id} value={scent.name}>
                            {scent.name}
                            {scent.seasonal && " (Seasonal)"}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="request-email" className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    id="request-email"
                    type="email"
                    required
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input w-full"
                    disabled={requestStatus === "loading"}
                  />
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    We&apos;ll notify you when this product is back in stock and add you to our mailing list.
                  </p>
                </div>

                {requestStatus === "error" && (
                  <p className="text-sm text-rose-600">{requestMessage}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      setRequestEmail("");
                      setRequestWickType("");
                      setRequestScent("");
                      setRequestStatus("idle");
                      setRequestMessage("");
                    }}
                    disabled={requestStatus === "loading"}
                    className="btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={requestStatus === "loading"}
                    className="btn btn-primary"
                  >
                    {requestStatus === "loading" ? "Submitting..." : "Notify Me"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}