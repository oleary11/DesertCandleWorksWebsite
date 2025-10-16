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

  // Use all global scents - don't filter by variantData
  // Separate scents into standard and seasonal
  const standardScents = useMemo(() => globalScents.filter(s => !s.experimental), [globalScents]);
  const seasonalScents = useMemo(() => globalScents.filter(s => s.experimental), [globalScents]);

  // Check if this product has any seasonal scents configured in its variantData
  const hasSeasonalScents = useMemo(() => {
    if (!product.variantConfig) return false;
    const seasonalScentIds = new Set(seasonalScents.map(s => s.id));

    // Check if any variant in variantData uses a seasonal scent
    return Object.keys(product.variantConfig.variantData).some(variantId => {
      const parts = variantId.split('-');
      const scentId = parts.slice(1).join('-');
      return seasonalScentIds.has(scentId);
    });
  }, [product.variantConfig, seasonalScents]);

  // Find first in-stock variant to use as default
  const getDefaultVariant = () => {
    const inStockVariant = variants.find(v =>
      v.stock > 0 && standardScents.some(s => s.id === v.scent)
    ) || variants.find(v => v.stock > 0);

    if (inStockVariant) {
      return {
        wickType: inStockVariant.wickType,
        scent: inStockVariant.scent,
        scentGroup: standardScents.some(s => s.id === inStockVariant.scent) ? "standard" as const : "seasonal" as const
      };
    }

    return {
      wickType: wickTypes[0]?.id || "",
      scent: standardScents[0]?.id || globalScents[0]?.id || "",
      scentGroup: "standard" as const
    };
  };

  const defaultVariant = getDefaultVariant();
  const [selectedWickType, setSelectedWickType] = useState(defaultVariant.wickType);
  const [scentGroup, setScentGroup] = useState<"standard" | "seasonal">(defaultVariant.scentGroup);
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
    return scentGroup === "standard" ? standardScents : seasonalScents;
  }, [scentGroup, standardScents, seasonalScents]);

  const selectedVariant = useMemo(() => {
    return variants.find(
      v => v.wickType === selectedWickType && v.scent === selectedScent
    );
  }, [variants, selectedWickType, selectedScent]);

  const stock = selectedVariant?.stock ?? 0;
  const canBuy = !!product.stripePriceId && stock > 0;

  // Helper to check if a scent has stock for the selected wick type
  const isScentAvailable = (scentId: string) => {
    return variants.some(
      v => v.wickType === selectedWickType && v.scent === scentId && v.stock > 0
    );
  };

  const selectedWickName = wickTypes.find(w => w.id === selectedWickType)?.name || "";
  const selectedScentName = globalScents.find(s => s.id === selectedScent)?.name || "";

  const handleAddToCart = () => {
    if (!canBuy || !selectedVariant) return;

    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
      variantId: selectedVariant.id,
      wickType: selectedVariant.wickType,
      scent: selectedVariant.scent,
      wickTypeName: selectedWickName,
      scentName: selectedScentName,
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

          {/* Wick Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Wick Type</label>
            <div className="grid grid-cols-2 gap-2">
              {wickTypes.map(wickType => {
                const isSelected = wickType.id === selectedWickType;
                return (
                  <button
                    key={wickType.id}
                    type="button"
                    onClick={() => {
                      setSelectedWickType(wickType.id);
                      // Auto-select first available scent for this wick type
                      const firstAvailableScent = variants.find(
                        v => v.wickType === wickType.id && v.stock > 0 && currentScents.some(s => s.id === v.scent)
                      )?.scent || currentScents[0]?.id || "";
                      setSelectedScent(firstAvailableScent);
                    }}
                    className={`
                      px-3 py-2 rounded-lg border text-sm font-medium transition
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

          {/* Scent Group Toggle (if seasonal scents exist) */}
          {hasSeasonalScents && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Scent Collection</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScentGroup("standard");
                    const firstStandardScent = standardScents[0]?.id;
                    if (firstStandardScent) setSelectedScent(firstStandardScent);
                  }}
                  className={`
                    flex-1 px-4 py-2 text-sm font-medium rounded-lg transition
                    ${scentGroup === "standard"
                      ? "border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                      : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                    }
                  `}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScentGroup("seasonal");
                    const firstSeasonalScent = seasonalScents[0]?.id;
                    if (firstSeasonalScent) setSelectedScent(firstSeasonalScent);
                  }}
                  className={`
                    flex-1 px-4 py-2 text-sm font-medium rounded-lg transition
                    ${scentGroup === "seasonal"
                      ? "border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                      : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                    }
                  `}
                >
                  Seasonal
                </button>
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
            ) : stock < 3 ? (
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
