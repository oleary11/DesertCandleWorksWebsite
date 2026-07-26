"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ShoppingCart, Search } from "lucide-react";
import { useCartStore } from "@/lib/cartStore";
import { trackEvent } from "@/components/AnalyticsTracker";
import type { BottlePickerOption } from "@/app/shop/[slug]/HomeGoodsBottlePicker";

type Props = {
  productSlug: string;
  productName: string;
  bottles: BottlePickerOption[];
  onClose: () => void;
};

export default function HomeGoodsQuickAddModal({ productSlug, productName, bottles, onClose }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);

  // Out-of-stock bottles aren't purchasable, so don't show them as a choice at all.
  const availableBottles = useMemo(() => bottles.filter((b) => b.stock > 0), [bottles]);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(availableBottles[0]?.bottleId);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  const selected = availableBottles.find((b) => b.bottleId === selectedId);
  const stock = selected?.stock ?? 0;
  const currentQuantityInCart = selected ? getItemQuantity(productSlug, selected.bottleId) : 0;
  const remainingStock = stock - currentQuantityInCart;
  const canBuy = !!selected && stock > 0;

  const filteredBottles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableBottles;
    return availableBottles.filter((b) => b.name.toLowerCase().includes(q));
  }, [availableBottles, search]);

  // Bottles arrive pre-sorted by alcohol-type order from the server, so grouping
  // consecutive same-type runs (via a Map, which preserves insertion order) is
  // enough — no separate sort-order data needs to travel to the client.
  const groupedBottles = useMemo(() => {
    const groups = new Map<string, BottlePickerOption[]>();
    for (const b of filteredBottles) {
      const key = b.alcoholType || "Other";
      const list = groups.get(key);
      if (list) list.push(b);
      else groups.set(key, [b]);
    }
    return Array.from(groups.entries());
  }, [filteredBottles]);

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

  function buildCartItem(bottle: BottlePickerOption) {
    return {
      productSlug,
      productName: `${productName} — ${bottle.name}`,
      productImage: bottle.imageUrl,
      price: bottle.priceCents / 100,
      // Not trusted directly at checkout — the server re-resolves price from
      // this product's bottleOptions using variantId (the bottle id) below.
      stripePriceId: "home_goods",
      variantId: bottle.bottleId,
      maxStock: bottle.stock,
      productType: "home_goods" as const,
    };
  }

  const handleAddToCart = () => {
    if (!selected) return;
    setIsAddingToCart(true);
    const success = addItem(buildCartItem(selected));
    if (success) {
      trackEvent("cart_add", {
        productSlug,
        productName: `${productName} — ${selected.name}`,
        priceCents: selected.priceCents,
      });
      setAddToCartMessage("✓ Added to cart!");
      setTimeout(() => {
        setAddToCartMessage("");
        setIsAddingToCart(false);
        onClose();
      }, 1000);
    } else {
      setAddToCartMessage("Cannot add more - stock limit reached");
      setTimeout(() => {
        setAddToCartMessage("");
        setIsAddingToCart(false);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ isolation: "isolate" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ zIndex: 60 }}
      />

      {/* Modal */}
      <div
        className="relative !bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
        style={{ zIndex: 61, backgroundColor: "#ffffff" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full !bg-white hover:!bg-neutral-100 transition shadow-md"
          style={{ zIndex: 62, backgroundColor: "#ffffff" }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header + Search (fixed) */}
        <div className="p-6 pb-4 !bg-white shrink-0" style={{ backgroundColor: "#ffffff" }}>
          <h2 className="text-xl font-semibold tracking-tight mb-1 pr-8">Quick Add</h2>
          <p className="text-sm text-[var(--color-muted)] mb-4">{productName}</p>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bottles..."
              className="input !pl-9"
            />
          </div>
        </div>

        {/* Bottle Grid (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          {availableBottles.length === 0 ? (
            <p className="text-sm text-rose-600 text-center py-8">Out of stock.</p>
          ) : filteredBottles.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] text-center py-8">
              No bottles match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <div className="space-y-5 pb-4">
              {groupedBottles.map(([type, bottles]) => (
                <div key={type}>
                  {groupedBottles.length > 1 && (
                    <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">{type}</div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {bottles.map((b) => {
                      const isSelected = b.bottleId === selectedId;
                      return (
                        <button
                          key={b.bottleId}
                          type="button"
                          onClick={() => setSelectedId(b.bottleId)}
                          className={`relative rounded-xl border-2 p-2 text-left transition ${
                            isSelected
                              ? "border-[var(--color-accent)] bg-[var(--color-mist)]"
                              : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                          }`}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-neutral-100 mb-2">
                            {b.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400 text-center px-1">
                                No photo
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-medium truncate" title={b.name}>{b.name}</div>
                          <div className="text-xs text-[var(--color-muted)]">${(b.priceCents / 100).toFixed(2)}</div>
                          {b.stock === 1 && <div className="text-[10px] text-rose-600 mt-0.5">Only 1 left</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Add to Cart footer */}
        <div className="p-6 pt-4 border-t border-[var(--color-line)] !bg-white shrink-0" style={{ backgroundColor: "#ffffff" }}>
          {selected && (
            <p className="text-sm mb-3">
              <span className="font-medium">{selected.name}</span>
              <span className="mx-1.5 text-[var(--color-muted)]">·</span>
              <span className="font-medium">${(selected.priceCents / 100).toFixed(2)}</span>
              {stock === 1 ? (
                <span className="ml-2 text-rose-600 font-medium">Only {stock} left</span>
              ) : (
                <span className="ml-2 text-[var(--color-muted)]">{stock} in stock</span>
              )}
            </p>
          )}

          {addToCartMessage && (
            <div className={`
              mb-3 p-3 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300
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

          <button
            onClick={handleAddToCart}
            disabled={!canBuy || remainingStock <= 0 || isAddingToCart}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
              [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
              text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
              hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
              ${!canBuy || remainingStock <= 0 || isAddingToCart ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
          >
            <ShoppingCart className="w-4 h-4" />
            {isAddingToCart
              ? "Adding..."
              : remainingStock <= 0 && currentQuantityInCart > 0
                ? "Max in Cart"
                : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
