"use client";

import { useState, useMemo, useEffect } from "react";
import type { Product, ProductVariant, VariantConfig } from "@/lib/productsStore";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { ShoppingCart } from "lucide-react";
import { useModal } from "@/hooks/useModal";

type Props = {
  product: Product;
  variants: ProductVariant[];
  globalScents: GlobalScent[];
  variantConfig: VariantConfig;
};

export default function ProductVariantForm({ product, variants, globalScents, variantConfig }: Props) {
  const { showAlert } = useModal();
  const { wickTypes } = variantConfig;
  const scents = globalScents; // Use global scents instead of per-product scents

  // Separate scents into favorites, seasonal, and limited
  const favoritesScents = useMemo(() => scents.filter(s => !s.seasonal && !s.limited), [scents]);
  const seasonalScents = useMemo(() => scents.filter(s => s.seasonal), [scents]);
  const limitedScents = useMemo(() => scents.filter(s => s.limited), [scents]);

  // Seasonal scents are available for ALL products
  const hasSeasonalScents = seasonalScents.length > 0;

  // Limited scents only show if THIS product has them configured in variantData
  const hasLimitedScents = useMemo(() => {
    const { variantData, wickTypes } = variantConfig;
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
  }, [variantConfig, limitedScents]);

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
      scent: favoritesScents[0]?.id || seasonalScents[0]?.id || limitedScents[0]?.id || scents[0]?.id || "",
      scentGroup: fallbackScentGroup
    };
  };

  const defaultVariant = getDefaultVariant();

  // Selected options
  const [selectedWickType, setSelectedWickType] = useState(defaultVariant.wickType);
  const [scentGroup, setScentGroup] = useState<"favorites" | "seasonal" | "limited">(defaultVariant.scentGroup);
  const [selectedScent, setSelectedScent] = useState(defaultVariant.scent);

  // Request scent modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestWickType, setRequestWickType] = useState("");
  const [requestScent, setRequestScent] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  // Cart store
  const addItem = useCartStore((state) => state.addItem);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);

  // Get the current scent list based on selected group
  const currentScents = useMemo(() => {
    if (scentGroup === "favorites") return favoritesScents;
    if (scentGroup === "seasonal") return seasonalScents;
    return limitedScents;
  }, [scentGroup, favoritesScents, seasonalScents, limitedScents]);

  // Find the matching variant
  const selectedVariant = useMemo(() => {
    return variants.find(
      v => v.wickType === selectedWickType && v.scent === selectedScent
    );
  }, [variants, selectedWickType, selectedScent]);

  const stock = selectedVariant?.stock ?? 0;
  const canBuy = !!product.stripePriceId && stock > 0;
  const currentQuantityInCart = getItemQuantity(product.slug, selectedVariant?.id);
  const remainingStock = stock - currentQuantityInCart;

  // Helper to check if a wick type has ANY available stock across scents in the current group
  const isWickTypeAvailable = (wickTypeId: string) => {
    return variants.some(v =>
      v.wickType === wickTypeId &&
      v.stock > 0 &&
      currentScents.some(s => s.id === v.scent) // Only count if scent is in current group
    );
  };

  // Helper to check if a scent has stock for the selected wick type
  const isScentAvailable = (scentId: string) => {
    return variants.some(
      v => v.wickType === selectedWickType && v.scent === scentId && v.stock > 0
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

  // Get display names for selected options
  const selectedWickName = wickTypes.find(w => w.id === selectedWickType)?.name || "";
  const selectedScentName = scents.find(s => s.id === selectedScent)?.name || "";

  // Handle add to cart
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
      setTimeout(() => setAddToCartMessage(""), 2500);
    } else {
      setAddToCartMessage("Cannot add more - stock limit reached");
      setTimeout(() => setAddToCartMessage(""), 3000);
    }
  };

  // Handle buy now
  const handleBuyNow = async () => {
    if (!canBuy || !selectedVariant) return;
    setIsBuying(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: [{
            price: product.stripePriceId!,
            quantity: 1,
            metadata: {
              productName: product.name,
              productImage: product.image,
              wickType: selectedWickName,
              scent: selectedScentName,
              variantId: selectedVariant.id,
            },
          }],
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        await showAlert("Failed to create checkout session", "Error");
        setIsBuying(false);
      }
    } catch (error) {
      console.error("Buy now error:", error);
      await showAlert("An error occurred", "Error");
      setIsBuying(false);
    }
  };

  // Handle scent request submission
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
    <div className="mt-6 space-y-4">
      {/* Stock Availability Table */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition list-none flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View stock for all combinations
        </summary>
        <div className="mt-3 p-3 rounded-lg bg-neutral-50 border border-[var(--color-line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="text-left py-2 font-medium">Wick Type</th>
                <th className="text-left py-2 font-medium">Scent</th>
                <th className="text-right py-2 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {variants
                .filter((variant) => {
                  // Only show variants where the scent is in the allowed globalScents list
                  return scents.some(s => s.id === variant.scent);
                })
                .map((variant) => {
                  const wickName = wickTypes.find(w => w.id === variant.wickType)?.name || variant.wickType;
                  const scentName = scents.find(s => s.id === variant.scent)?.name || variant.scent;
                  return (
                    <tr key={variant.id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="py-2">{wickName}</td>
                      <td className="py-2">{scentName}</td>
                      <td className="py-2 text-right">
                        {variant.stock <= 0 ? (
                          <span className="text-rose-600 text-xs">Out of stock</span>
                        ) : variant.stock === 1 ? (
                          <span className="text-amber-600 font-medium">{variant.stock}</span>
                        ) : (
                          <span className="text-[var(--color-muted)]">{variant.stock}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </details>

      {/* Wick Type Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Wick Type</label>
        <div className="grid grid-cols-2 gap-2">
          {wickTypes.map(wickType => {
            const available = isWickTypeAvailable(wickType.id);
            const isSelected = wickType.id === selectedWickType;
            return (
              <button
                key={wickType.id}
                type="button"
                onClick={() => {
                  setSelectedWickType(wickType.id);
                  // Auto-select first scent for this wick type (prefer in-stock, but allow out-of-stock)
                  // Only consider scents that are in the current scent group
                  const firstAvailableScent = variants.find(
                    v => v.wickType === wickType.id && v.stock > 0 && currentScents.some(s => s.id === v.scent)
                  )?.scent || variants.find(v => v.wickType === wickType.id && currentScents.some(s => s.id === v.scent))?.scent || currentScents[0]?.id || "";
                  setSelectedScent(firstAvailableScent);
                }}
                className={`
                  px-4 py-2 rounded-lg border text-sm font-medium transition cursor-pointer
                  ${isSelected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
                  }
                  ${!available ? "opacity-60" : ""}
                `}
              >
                {wickType.name}
                {!available && <span className="block text-xs mt-1">(Out of stock)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scent Group Toggle (show if there are seasonal or limited scents) */}
      {(hasSeasonalScents || hasLimitedScents) && (
        <div>
          <label className="block text-sm font-medium mb-2">Scent Collection</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                // Only auto-select if SWITCHING to a different group
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
                flex-1 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition
                ${!hasInStockFavoritesScents
                  ? "border-2 border-[var(--color-line)] opacity-50 cursor-not-allowed"
                  : scentGroup === "favorites"
                  ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]"
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
                  // Only auto-select if SWITCHING to a different group
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
                  flex-1 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition
                  ${!hasInStockSeasonalScents
                    ? "border-2 border-[var(--color-line)] opacity-50 cursor-not-allowed"
                    : scentGroup === "seasonal"
                    ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]"
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
                  // Only auto-select if SWITCHING to a different group
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
                  flex-1 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition
                  ${!hasInStockLimitedScents
                    ? "border-2 border-[var(--color-line)] opacity-50 cursor-not-allowed"
                    : scentGroup === "limited"
                    ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]"
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
          className="input w-full"
          size={1}
        >
          {currentScents
            .filter(scent => isScentAvailable(scent.id))
            .map(scent => (
              <option key={scent.id} value={scent.id}>
                {scent.name}
              </option>
            ))}
        </select>
        {/* Display scent notes for selected scent */}
        {(() => {
          const selectedScentObj = scents.find(s => s.id === selectedScent);
          if (selectedScentObj?.notes && selectedScentObj.notes.length > 0) {
            return (
              <div className="mt-2 text-sm text-[var(--color-muted)] italic">
                Notes: {selectedScentObj.notes.join(", ")}
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Stock Display */}
      <p className="text-sm">
        {stock <= 0 ? (
          <span className="text-rose-600 font-medium">Out of stock</span>
        ) : stock === 1 ? (
          <span className="text-rose-600 font-medium">Only {stock} left — almost gone</span>
        ) : (
          <span className="text-[var(--color-muted)]">{stock} in stock</span>
        )}
        {currentQuantityInCart > 0 && (
          <span className="ml-2 text-xs text-[var(--color-muted)]">
            ({currentQuantityInCart} in cart)
          </span>
        )}
      </p>

      {addToCartMessage && (
        <div className={`
          mt-2 p-3 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300
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

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!canBuy || remainingStock <= 0}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
          border-2 !border-[var(--color-accent)]
          text-[var(--color-accent)]
          hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)]
          transition
          ${!canBuy || remainingStock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ShoppingCart className="w-4 h-4" />
          {remainingStock <= 0 && currentQuantityInCart > 0 ? "Max in Cart" : "Add to Cart"}
        </button>

        <button
          onClick={handleBuyNow}
          disabled={!canBuy || isBuying}
          className={`flex-1 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium border-0
          [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
          text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
          hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
          ${!canBuy || isBuying ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
        >
          {isBuying ? "Processing..." : "Buy Now"}
        </button>
      </div>

      {/* Request Scent Button (always shown) */}
      <button
        type="button"
        onClick={() => setShowRequestModal(true)}
        className="w-full inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium border border-[var(--color-line)]
        hover:border-[var(--color-accent)] transition cursor-pointer"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Request a scent in this bottle
      </button>

      {/* Sticky Add to Cart Button (Mobile Only) - Always shown */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white border-t border-[var(--color-line)] shadow-[0_-4px_16px_rgba(0,0,0,0.1)] md:hidden">
        <div className="flex gap-3 max-w-xl mx-auto">
          <button
            onClick={handleAddToCart}
            disabled={!canBuy || remainingStock <= 0}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-medium
            [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
            text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
            hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] transition
            ${!canBuy || remainingStock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="flex flex-col items-start">
              <span className="text-xs leading-none mb-0.5">${product.price}</span>
              <span className="leading-none">
                {remainingStock <= 0 && currentQuantityInCart > 0 ? "Max in Cart" : "Add to Cart"}
              </span>
            </span>
          </button>
        </div>
      </div>

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
                {/* Wick Type Selector */}
                {wickTypes.length > 0 && (
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
                      {wickTypes.map((wick) => (
                        <option key={wick.id} value={wick.name}>
                          {wick.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scent Selector - Show ALL scents (including out of stock) */}
                {scents.length > 0 && (
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
                      {scents
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
    </div>
  );
}
