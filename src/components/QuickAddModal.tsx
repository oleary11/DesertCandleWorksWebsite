"use client";

import { useState, useEffect, useMemo } from "react";
import { X, ShoppingCart } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/productsStore";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";

type QuickAddModalProps = {
  product: Product & { _computedStock?: number };
  variants: ProductVariant[];
  globalScents: GlobalScent[];
  wickTypes: Array<{ id: string; name: string }>;
  onClose: () => void;
};

export default function QuickAddModal({
  product,
  variants,
  globalScents,
  wickTypes,
  onClose,
}: QuickAddModalProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  // Get sizes from product variant config
  const sizes = product.variantConfig?.sizes || [];
  const hasSizes = sizes && sizes.length > 0;

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
        size: inStockVariant.size || sizes[0]?.id || "",
        wickType: inStockVariant.wickType,
        scent: inStockVariant.scent,
        scentGroup
      };
    }

    let fallbackScentGroup: "favorites" | "seasonal" | "limited" = "favorites";
    if (favoritesScents.length > 0) {
      fallbackScentGroup = "favorites";
    } else if (seasonalScents.length > 0) {
      fallbackScentGroup = "seasonal";
    } else {
      fallbackScentGroup = "limited";
    }

    return {
      size: sizes[0]?.id || "",
      wickType: wickTypes[0]?.id || "",
      scent: favoritesScents[0]?.id || seasonalScents[0]?.id || limitedScents[0]?.id || globalScents[0]?.id || "",
      scentGroup: fallbackScentGroup
    };
  };

  const defaultVariant = getDefaultVariant();
  const [selectedSize, setSelectedSize] = useState(defaultVariant.size);
  const [selectedWickType, setSelectedWickType] = useState(defaultVariant.wickType);
  const [scentGroup, setScentGroup] = useState<"favorites" | "seasonal" | "limited">(defaultVariant.scentGroup);
  const [selectedScent, setSelectedScent] = useState(defaultVariant.scent);

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

  const currentScents = useMemo(() => {
    if (scentGroup === "favorites") return favoritesScents;
    if (scentGroup === "seasonal") return seasonalScents;
    return limitedScents;
  }, [scentGroup, favoritesScents, seasonalScents, limitedScents]);

  const selectedVariant = useMemo(() => {
    return variants.find(
      v => v.wickType === selectedWickType && v.scent === selectedScent && (!hasSizes || v.size === selectedSize)
    );
  }, [variants, selectedWickType, selectedScent, selectedSize, hasSizes]);

  const stock = selectedVariant?.stock ?? 0;
  const canBuy = !!product.stripePriceId && stock > 0;

  // Helper to check if a size has stock for any wick type and scent combination
  const isSizeAvailable = (sizeId: string) => {
    return variants.some(
      v => v.size === sizeId && v.stock > 0
    );
  };

  // Helper to check if a wick type has stock for the selected size (if applicable) and any scent
  const isWickTypeAvailable = (wickTypeId: string) => {
    return variants.some(
      v => v.wickType === wickTypeId && v.stock > 0 && (!hasSizes || v.size === selectedSize)
    );
  };

  // Helper to check if a scent has stock for the selected wick type and size
  const isScentAvailable = (scentId: string) => {
    return variants.some(
      v => v.wickType === selectedWickType && v.scent === scentId && v.stock > 0 && (!hasSizes || v.size === selectedSize)
    );
  };

  // Check if there are any in-stock scents in each category (for disabling buttons)
  const hasInStockFavoritesScents = useMemo(() =>
    favoritesScents.some(s => isScentAvailable(s.id)),
    [favoritesScents, selectedWickType, variants]
  );

  const hasInStockSeasonalScents = useMemo(() =>
    seasonalScents.some(s => isScentAvailable(s.id)),
    [seasonalScents, selectedWickType, variants]
  );

  const hasInStockLimitedScents = useMemo(() =>
    limitedScents.some(s => isScentAvailable(s.id)),
    [limitedScents, selectedWickType, variants]
  );

  const selectedSizeName = sizes.find(s => s.id === selectedSize)?.name || "";
  const selectedWickName = wickTypes.find(w => w.id === selectedWickType)?.name || "";
  const selectedScentName = globalScents.find(s => s.id === selectedScent)?.name || "";

  const handleAddToCart = () => {
    if (!canBuy || !selectedVariant) return;

    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: selectedVariant.priceCents / 100,
      stripePriceId: selectedVariant.stripePriceId || product.stripePriceId!,
      maxStock: stock,
      variantId: selectedVariant.id,
      size: selectedSizeName,
      wickType: selectedWickName,
      scent: selectedScentName,
    });

    if (success) {
      setAddToCartMessage("✓ Added to cart!");
      setTimeout(() => {
        setAddToCartMessage("");
        onClose();
      }, 1000);
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
        className="relative !bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200"
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

        <div className="p-6 !bg-white" style={{ backgroundColor: '#ffffff' }}>
          <h2 className="text-xl font-semibold tracking-tight mb-1 pr-8">
            Quick Add
          </h2>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            {product.name}
          </p>

          {/* Size Selector (if product has sizes) */}
          {hasSizes && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Size</label>
              <div className="grid grid-cols-2 gap-2">
                {sizes.map(size => {
                  const isSelected = size.id === selectedSize;
                  const isAvailable = isSizeAvailable(size.id);
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => {
                        if (!isAvailable) return;
                        setSelectedSize(size.id);
                        // Auto-select first available wick type and scent for this size
                        const firstAvailableVariant = variants.find(
                          v => v.size === size.id && v.stock > 0
                        );
                        if (firstAvailableVariant) {
                          setSelectedWickType(firstAvailableVariant.wickType);
                          setSelectedScent(firstAvailableVariant.scent);
                          // Update scent group based on selected scent
                          if (favoritesScents.some(s => s.id === firstAvailableVariant.scent)) {
                            setScentGroup("favorites");
                          } else if (seasonalScents.some(s => s.id === firstAvailableVariant.scent)) {
                            setScentGroup("seasonal");
                          } else {
                            setScentGroup("limited");
                          }
                        }
                      }}
                      disabled={!isAvailable}
                      className={`
                        px-3 py-2 rounded-lg border text-sm font-medium transition relative
                        ${!isAvailable
                          ? "border-[var(--color-line)] opacity-50 cursor-not-allowed"
                          : isSelected
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                          : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
                        }
                      `}
                    >
                      {size.name}
                      {!isAvailable && (
                        <span className="block text-xs mt-1 text-rose-600">Out of stock</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wick Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Wick Type</label>
            <div className="grid grid-cols-2 gap-2">
              {wickTypes.map(wickType => {
                const isSelected = wickType.id === selectedWickType;
                const isAvailable = isWickTypeAvailable(wickType.id);
                return (
                  <button
                    key={wickType.id}
                    type="button"
                    onClick={() => {
                      if (!isAvailable) return;
                      setSelectedWickType(wickType.id);
                      // Auto-select first available scent for this wick type and size
                      const firstAvailableScent = variants.find(
                        v => v.wickType === wickType.id && v.stock > 0 && currentScents.some(s => s.id === v.scent) && (!hasSizes || v.size === selectedSize)
                      )?.scent || currentScents[0]?.id || "";
                      setSelectedScent(firstAvailableScent);
                    }}
                    disabled={!isAvailable}
                    className={`
                      px-3 py-2 rounded-lg border text-sm font-medium transition relative
                      ${!isAvailable
                        ? "border-[var(--color-line)] opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                        : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
                      }
                    `}
                  >
                    {wickType.name}
                    {!isAvailable && (
                      <span className="block text-xs mt-1 text-rose-600">Out of stock</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scent Group Toggle (show if there are seasonal or limited scents) */}
          {(hasSeasonalScents || hasLimitedScents) && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Scent Collection</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Only switch if SWITCHING to a different group and has stock
                    if (scentGroup !== "favorites" && hasInStockFavoritesScents) {
                      setScentGroup("favorites");
                      // Auto-select first IN-STOCK favorites scent when switching
                      const firstInStockFavoritesScent = favoritesScents.find(s => isScentAvailable(s.id));
                      if (firstInStockFavoritesScent) {
                        setSelectedScent(firstInStockFavoritesScent.id);
                      }
                    }
                  }}
                  disabled={!hasInStockFavoritesScents}
                  className={`
                    flex-1 px-3 py-2 text-sm font-medium rounded-lg transition relative flex flex-col items-center justify-center
                    ${!hasInStockFavoritesScents
                      ? "border-2 border-[var(--color-line)] opacity-50 cursor-not-allowed"
                      : scentGroup === "favorites"
                      ? "border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                      : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                    }
                  `}
                >
                  <span>Favorites</span>
                  {!hasInStockFavoritesScents && (
                    <span className="text-xs mt-1 text-rose-600">Out of stock</span>
                  )}
                </button>
                {hasSeasonalScents && (
                  <button
                    type="button"
                    onClick={() => {
                      // Only switch if SWITCHING to a different group and has stock
                      if (scentGroup !== "seasonal" && hasInStockSeasonalScents) {
                        setScentGroup("seasonal");
                        // Auto-select first IN-STOCK seasonal scent when switching
                        const firstInStockSeasonalScent = seasonalScents.find(s => isScentAvailable(s.id));
                        if (firstInStockSeasonalScent) {
                          setSelectedScent(firstInStockSeasonalScent.id);
                        }
                      }
                    }}
                    disabled={!hasInStockSeasonalScents}
                    className={`
                      flex-1 px-3 py-2 text-sm font-medium rounded-lg transition relative flex flex-col items-center justify-center
                      ${!hasInStockSeasonalScents
                        ? "border-2 border-[var(--color-line)] opacity-50 cursor-not-allowed"
                        : scentGroup === "seasonal"
                        ? "border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                        : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                      }
                    `}
                  >
                    <span>Seasonal</span>
                    {!hasInStockSeasonalScents && (
                      <span className="text-xs mt-1 text-rose-600">Out of stock</span>
                    )}
                  </button>
                )}
                {hasLimitedScents && (
                  <button
                    type="button"
                    onClick={() => {
                      // Only switch if SWITCHING to a different group and has stock
                      if (scentGroup !== "limited" && hasInStockLimitedScents) {
                        setScentGroup("limited");
                        // Auto-select first IN-STOCK limited scent when switching
                        const firstInStockLimitedScent = limitedScents.find(s => isScentAvailable(s.id));
                        if (firstInStockLimitedScent) {
                          setSelectedScent(firstInStockLimitedScent.id);
                        }
                      }
                    }}
                    disabled={!hasInStockLimitedScents}
                    className={`
                      flex-1 px-3 py-2 text-sm font-medium rounded-lg transition relative flex flex-col items-center justify-center
                      ${!hasInStockLimitedScents
                        ? "border-2 border-[var(--color-line)] opacity-50 cursor-not-allowed"
                        : scentGroup === "limited"
                        ? "border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                        : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                      }
                    `}
                  >
                    <span>Limited</span>
                    {!hasInStockLimitedScents && (
                      <span className="text-xs mt-1 text-rose-600">Out of stock</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scent Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Scent</label>
            <select
              value={selectedScent}
              onChange={e => setSelectedScent(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1"
            >
              {currentScents.map(scent => {
                const available = isScentAvailable(scent.id);
                return (
                  <option key={scent.id} value={scent.id}>
                    {scent.name} {!available ? "(Out of stock)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Stock Display */}
          <p className="text-sm mb-4">
            {stock <= 0 ? (
              <span className="text-rose-600 font-medium">Out of stock</span>
            ) : stock === 1 ? (
              <span className="text-amber-600 font-medium">Only {stock} left</span>
            ) : (
              <span className="text-green-600 font-medium">{stock} in stock</span>
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

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!canBuy}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
              [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
              text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
              hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
              ${!canBuy ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
          >
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
