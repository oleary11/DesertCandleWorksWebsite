"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ExternalLink, ShoppingCart } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";

type QuickViewModalProps = {
  product: Product & { _computedStock?: number };
  variants?: ProductVariant[];
  globalScents?: GlobalScent[];
  onClose: () => void;
};

export default function QuickViewModal({ product, variants = [], globalScents = [], onClose }: QuickViewModalProps) {
  const [addToCartMessage, setAddToCartMessage] = useState("");
  const addItem = useCartStore((state) => state.addItem);

  const hasVariants = !!product.variantConfig && variants.length > 0;

  // Separate scents into favorites, seasonal, and limited
  const favoritesScents = useMemo(() => globalScents.filter(s => !s.seasonal && !s.limited), [globalScents]);
  const seasonalScents = useMemo(() => globalScents.filter(s => s.seasonal), [globalScents]);
  const limitedScents = useMemo(() => globalScents.filter(s => s.limited), [globalScents]);

  // Seasonal scents are available for ALL products
  const hasSeasonalScents = seasonalScents.length > 0;

  // Limited scents only show if THIS product has them configured in variantData
  const hasLimitedScents = useMemo(() => {
    if (!product.variantConfig) return false;
    const { variantData, wickTypes } = product.variantConfig;
    const wickIds = new Set(wickTypes.map(w => w.id));

    // Check if any variantData key contains a limited scent
    return Object.keys(variantData).some(variantId => {
      // Extract scent ID by removing wick type prefix
      let scentId = variantId;
      for (const wickId of wickIds) {
        if (variantId.startsWith(wickId + '-')) {
          scentId = variantId.substring(wickId.length + 1);
          break;
        }
      }
      return limitedScents.some(s => s.id === scentId);
    });
  }, [product.variantConfig, limitedScents]);

  // Find first in-stock variant to use as default
  const getDefaultVariant = () => {
    if (!hasVariants) return null;

    const wickTypes = product.variantConfig!.wickTypes;

    // Try to find in-stock variant in order of preference: favorites > seasonal > limited
    const inStockFavorites = variants.find(v =>
      v.stock > 0 && favoritesScents.some(s => s.id === v.scent)
    );
    const inStockSeasonal = variants.find(v =>
      v.stock > 0 && seasonalScents.some(s => s.id === v.scent)
    );
    const inStockLimited = variants.find(v =>
      v.stock > 0 && limitedScents.some(s => s.id === v.scent)
    );

    const inStockVariant = inStockFavorites || inStockSeasonal || inStockLimited;

    if (inStockVariant) {
      let scentGroup: "favorites" | "seasonal" | "limited" = "favorites";
      if (seasonalScents.some(s => s.id === inStockVariant.scent)) {
        scentGroup = "seasonal";
      } else if (limitedScents.some(s => s.id === inStockVariant.scent)) {
        scentGroup = "limited";
      }

      return {
        wickType: inStockVariant.wickType,
        scent: inStockVariant.scent,
        scentGroup
      };
    }

    // Fallback to first variant if nothing in stock
    let fallbackScentGroup: "favorites" | "seasonal" | "limited" = "favorites";
    if (favoritesScents.length > 0) {
      fallbackScentGroup = "favorites";
    } else if (seasonalScents.length > 0) {
      fallbackScentGroup = "seasonal";
    } else {
      fallbackScentGroup = "limited";
    }

    return {
      wickType: wickTypes[0]?.id || "",
      scent: favoritesScents[0]?.id || seasonalScents[0]?.id || limitedScents[0]?.id || globalScents[0]?.id || "",
      scentGroup: fallbackScentGroup
    };
  };

  const defaultVariant = getDefaultVariant();

  const [selectedWickType, setSelectedWickType] = useState(defaultVariant?.wickType || "");
  const [scentGroup, setScentGroup] = useState<"favorites" | "seasonal" | "limited">(defaultVariant?.scentGroup || "favorites");
  const [selectedScent, setSelectedScent] = useState(defaultVariant?.scent || "");

  // Get the current scent list based on selected group
  const currentScents = useMemo(() => {
    if (scentGroup === "favorites") return favoritesScents;
    if (scentGroup === "seasonal") return seasonalScents;
    return limitedScents;
  }, [scentGroup, favoritesScents, seasonalScents, limitedScents]);

  // Find the matching variant
  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return variants.find(
      v => v.wickType === selectedWickType && v.scent === selectedScent
    );
  }, [hasVariants, variants, selectedWickType, selectedScent]);

  const stock = hasVariants ? (selectedVariant?.stock ?? 0) : (product._computedStock ?? product.stock ?? 0);
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

  const getItemQuantity = useCartStore((state) => state.getItemQuantity);
  const currentQuantityInCart = hasVariants ? getItemQuantity(product.slug, selectedVariant?.id) : 0;
  const remainingStock = stock - currentQuantityInCart;

  const handleAddToCart = () => {
    if (!canBuy || (hasVariants && remainingStock <= 0)) return;

    const wickTypes = product.variantConfig?.wickTypes || [];
    const selectedWickName = wickTypes.find(w => w.id === selectedWickType)?.name || "";
    const selectedScentName = globalScents.find(s => s.id === selectedScent)?.name || "";

    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
      ...(hasVariants && selectedVariant ? {
        variantId: selectedVariant.id,
        wickType: selectedVariant.wickType,
        scent: selectedVariant.scent,
        wickTypeName: selectedWickName,
        scentName: selectedScentName,
      } : {}),
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

            {/* Variant Selector */}
            {hasVariants && product.variantConfig && (
              <div className="space-y-4 mb-6">
                {/* Wick Type Selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">Wick Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {product.variantConfig.wickTypes.map(wickType => {
                      const isSelected = wickType.id === selectedWickType;
                      return (
                        <button
                          key={wickType.id}
                          type="button"
                          onClick={() => {
                            setSelectedWickType(wickType.id);
                            // Auto-select first scent for this wick type
                            const firstAvailableScent = variants.find(
                              v => v.wickType === wickType.id && v.stock > 0 && currentScents.some(s => s.id === v.scent)
                            )?.scent || variants.find(v => v.wickType === wickType.id && currentScents.some(s => s.id === v.scent))?.scent || currentScents[0]?.id || "";
                            setSelectedScent(firstAvailableScent);
                          }}
                          className={`
                            px-3 py-2 rounded-lg border text-sm font-medium transition cursor-pointer
                            ${isSelected
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                              : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
                            }
                          `}
                        >
                          {wickType.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scent Group Toggle */}
                {(hasSeasonalScents || hasLimitedScents) && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Scent Collection</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScentGroup("favorites");
                          const firstFavoritesScent = favoritesScents[0]?.id;
                          if (firstFavoritesScent) setSelectedScent(firstFavoritesScent);
                        }}
                        className={`
                          flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition
                          ${scentGroup === "favorites"
                            ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                            : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                          }
                        `}
                      >
                        Favorites
                      </button>
                      {hasSeasonalScents && (
                        <button
                          type="button"
                          onClick={() => {
                            setScentGroup("seasonal");
                            const firstSeasonalScent = seasonalScents[0]?.id;
                            if (firstSeasonalScent) setSelectedScent(firstSeasonalScent);
                          }}
                          className={`
                            flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition
                            ${scentGroup === "seasonal"
                              ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                              : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                            }
                          `}
                        >
                          Seasonal
                        </button>
                      )}
                      {hasLimitedScents && (
                        <button
                          type="button"
                          onClick={() => {
                            setScentGroup("limited");
                            const firstLimitedScent = limitedScents[0]?.id;
                            if (firstLimitedScent) setSelectedScent(firstLimitedScent);
                          }}
                          className={`
                            flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition
                            ${scentGroup === "limited"
                              ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                              : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                            }
                          `}
                        >
                          Limited
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Scent Selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">Scent</label>
                  <select
                    value={selectedScent}
                    onChange={e => setSelectedScent(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  >
                    {currentScents.map(scent => {
                      const available = variants.some(
                        v => v.wickType === selectedWickType && v.scent === scent.id && v.stock > 0
                      );
                      return (
                        <option key={scent.id} value={scent.id}>
                          {scent.name} {!available ? "(Out of stock)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {/* Display scent notes */}
                  {(() => {
                    const selectedScentObj = globalScents.find(s => s.id === selectedScent);
                    if (selectedScentObj?.notes && selectedScentObj.notes.length > 0) {
                      return (
                        <div className="mt-2 text-xs text-[var(--color-muted)] italic">
                          Notes: {selectedScentObj.notes.join(", ")}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* Stock status */}
            <p className="text-sm mb-6">
              {stock <= 0 ? (
                <span className="text-rose-600 font-medium">Out of stock</span>
              ) : stock === 1 ? (
                <span className="text-rose-600 font-medium">Only {stock} left — almost gone</span>
              ) : (
                <span className="text-[var(--color-muted)]">{stock} in stock</span>
              )}
              {hasVariants && currentQuantityInCart > 0 && (
                <span className="ml-2 text-xs text-[var(--color-muted)]">
                  ({currentQuantityInCart} in cart)
                </span>
              )}
            </p>

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
              <button
                onClick={handleAddToCart}
                disabled={!canBuy || (hasVariants && remainingStock <= 0)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
                  [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                  text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
                  hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
                  ${!canBuy || (hasVariants && remainingStock <= 0) ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
              >
                <ShoppingCart className="w-4 h-4" />
                {hasVariants && remainingStock <= 0 && currentQuantityInCart > 0 ? "Max in Cart" : "Add to Cart"}
              </button>

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
