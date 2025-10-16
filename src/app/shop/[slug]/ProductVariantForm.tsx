"use client";

import { useState, useMemo } from "react";
import type { Product, ProductVariant, VariantConfig } from "@/lib/productsStore";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { ShoppingCart } from "lucide-react";

type Props = {
  product: Product;
  variants: ProductVariant[];
  globalScents: GlobalScent[];
  variantConfig: VariantConfig;
};

export default function ProductVariantForm({ product, variants, globalScents, variantConfig }: Props) {
  const { wickTypes } = variantConfig;
  const scents = globalScents; // Use global scents instead of per-product scents

  // Separate scents into standard and seasonal (experimental)
  const standardScents = useMemo(() => scents.filter(s => !s.experimental), [scents]);
  const seasonalScents = useMemo(() => scents.filter(s => s.experimental), [scents]);
  const hasSeasonalScents = seasonalScents.length > 0;

  // Find first in-stock variant to use as default
  const getDefaultVariant = () => {
    // Try to find ANY in-stock variant (prefer standard scents)
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

    // Fallback to first variant if nothing in stock
    return {
      wickType: wickTypes[0]?.id || "",
      scent: standardScents[0]?.id || scents[0]?.id || "",
      scentGroup: "standard" as const
    };
  };

  const defaultVariant = getDefaultVariant();

  // Selected options
  const [selectedWickType, setSelectedWickType] = useState(defaultVariant.wickType);
  const [scentGroup, setScentGroup] = useState<"standard" | "seasonal">(defaultVariant.scentGroup);
  const [selectedScent, setSelectedScent] = useState(defaultVariant.scent);

  // Request scent modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  // Cart store
  const addItem = useCartStore((state) => state.addItem);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);

  // Get the current scent list based on selected group
  const currentScents = useMemo(() => {
    return scentGroup === "standard" ? standardScents : seasonalScents;
  }, [scentGroup, standardScents, seasonalScents]);

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
      setAddToCartMessage("Added to cart!");
      setTimeout(() => setAddToCartMessage(""), 2000);
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
        alert("Failed to create checkout session");
        setIsBuying(false);
      }
    } catch (error) {
      console.error("Buy now error:", error);
      alert("An error occurred");
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
          wickType: selectedWickName,
          scent: selectedScentName,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setRequestStatus("success");
        setRequestMessage(data.message || "Request submitted successfully!");
        setTimeout(() => {
          setShowRequestModal(false);
          setRequestEmail("");
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
                        ) : variant.stock < 3 ? (
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

      {/* Scent Group Toggle (only show if there are seasonal scents) */}
      {hasSeasonalScents && (
        <div>
          <label className="block text-sm font-medium mb-2">Scent Collection</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setScentGroup("standard");
                // Auto-select first standard scent when switching
                const firstStandardScent = standardScents[0]?.id;
                if (firstStandardScent) {
                  setSelectedScent(firstStandardScent);
                }
              }}
              className={`
                flex-1 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition
                ${scentGroup === "standard"
                  ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]"
                  : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                }
              `}
            >
              Standard Scents
            </button>
            <button
              type="button"
              onClick={() => {
                setScentGroup("seasonal");
                // Auto-select first seasonal scent when switching
                const firstSeasonalScent = seasonalScents[0]?.id;
                if (firstSeasonalScent) {
                  setSelectedScent(firstSeasonalScent);
                }
              }}
              className={`
                flex-1 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition
                ${scentGroup === "seasonal"
                  ? "border-2 !border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]"
                  : "border-2 border-[var(--color-line)] hover:border-[var(--color-accent)]"
                }
              `}
            >
              Seasonal Scents
            </button>
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
      <p className="text-sm">
        {stock <= 0 ? (
          <span className="text-rose-600 font-medium">Out of stock</span>
        ) : stock < 3 ? (
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
        <p className={`mt-2 text-sm font-medium ${addToCartMessage.includes("Cannot") ? "text-rose-600" : "text-green-600"}`}>
          {addToCartMessage}
        </p>
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

      {/* Request Scent Button (shown when out of stock) */}
      {stock <= 0 && (
        <button
          type="button"
          onClick={() => setShowRequestModal(true)}
          className="w-full inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium border border-[var(--color-line)]
          hover:border-[var(--color-accent)] transition cursor-pointer"
        >
          Request This Scent
        </button>
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
            <h3 className="text-lg font-semibold mb-2">Request This Scent</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              {product.name} - {selectedWickName} / {selectedScentName}
            </p>

            {requestStatus === "success" ? (
              <div className="text-sm text-green-600 dark:text-green-400">
                {requestMessage}
              </div>
            ) : (
              <form onSubmit={handleRequestScent} className="space-y-4">
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
                    We&apos;ll notify you when this scent is back in stock and add you to our mailing list.
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
