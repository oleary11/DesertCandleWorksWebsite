"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ExternalLink, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/products";
import { useCartStore } from "@/lib/cartStore";

type QuickViewModalProps = {
  product: Product & { _computedStock?: number };
  onClose: () => void;
};

export default function QuickViewModal({ product, onClose }: QuickViewModalProps) {
  const [addToCartMessage, setAddToCartMessage] = useState("");
  const addItem = useCartStore((state) => state.addItem);
  const stock = product._computedStock ?? product.stock ?? 0;
  const canBuy = !!product.stripePriceId && stock > 0;

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleAddToCart = () => {
    if (!canBuy) return;

    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
    });

    if (success) {
      setAddToCartMessage("✓ Added to cart!");
      setTimeout(() => {
        setAddToCartMessage("");
        onClose();
      }, 1500);
    } else {
      setAddToCartMessage("Cannot add more - stock limit reached");
      setTimeout(() => setAddToCartMessage(""), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ zIndex: 60 }}
      />

      {/* Modal */}
      <div
        className="relative !bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        style={{ zIndex: 61, backgroundColor: '#ffffff !important' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full !bg-white hover:!bg-neutral-100 transition shadow-md"
          style={{ zIndex: 62, backgroundColor: '#ffffff' }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid md:grid-cols-2 gap-6 p-6 !bg-white" style={{ backgroundColor: '#ffffff' }}>
          {/* Image */}
          <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-neutral-100">
            {product.image && (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain"
                sizes="(min-width: 768px) 50vw, 90vw"
                quality={90}
                priority
              />
            )}
            {product.bestSeller && (
              <span className="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
                ⭐ Best Seller
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
              {product.name}
            </h2>

            <p className="text-sm text-[var(--color-muted)] mb-4">
              {product.seoDescription}
            </p>

            <p className="text-2xl font-medium mb-4">${product.price}</p>

            {/* Stock status */}
            <p className="text-sm mb-6">
              {stock <= 0 ? (
                <span className="text-rose-600 font-medium">Out of stock</span>
              ) : stock < 3 ? (
                <span className="text-amber-600 font-medium">Only {stock} left!</span>
              ) : (
                <span className="text-green-600 font-medium">{stock} in stock</span>
              )}
            </p>

            {/* Note about variants */}
            {product.variantConfig && (
              <div className="mb-6 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> This product has multiple scent and wick options.
                  <Link href={`/shop/${product.slug}`} className="ml-1 underline font-medium hover:text-blue-700">
                    View all options →
                  </Link>
                </p>
              </div>
            )}

            {addToCartMessage && (
              <div className={`
                mb-4 p-3 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300
                ${addToCartMessage.includes("Cannot")
                  ? "bg-rose-50 border border-rose-200"
                  : "bg-green-50 border border-green-200"
                }
              `}>
                <p className={`text-sm font-medium flex items-center gap-2 ${
                  addToCartMessage.includes("Cannot") ? "text-rose-700" : "text-green-700"
                }`}>
                  {!addToCartMessage.includes("Cannot") && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold animate-in zoom-in duration-200">
                      ✓
                    </span>
                  )}
                  {addToCartMessage}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-auto">
              {!product.variantConfig ? (
                <button
                  onClick={handleAddToCart}
                  disabled={!canBuy}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
                    [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                    text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
                    hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
                    ${!canBuy ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
              ) : null}

              <Link
                href={`/shop/${product.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
                  border-2 border-[var(--color-accent)] text-[var(--color-accent)]
                  hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)] transition"
              >
                <ExternalLink className="w-4 h-4" />
                View Full Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
