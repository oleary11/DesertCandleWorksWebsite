"use client";

import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/lib/cartStore";
import { ShoppingCart, Search, X } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import { trackEvent } from "@/components/AnalyticsTracker";

export type BottlePickerOption = {
  bottleId: string;
  name: string;
  imageUrl?: string;
  priceCents: number;
  stock: number;
  alcoholType?: string; // for grouping the picker into sections — bottles arrive pre-sorted by type
};

type Props = {
  productSlug: string;
  productName: string;
  bottles: BottlePickerOption[];
};

export default function HomeGoodsBottlePicker({ productSlug, productName, bottles }: Props) {
  const { showAlert } = useModal();
  const addItem = useCartStore((state) => state.addItem);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);

  // Out-of-stock bottles aren't purchasable, so don't show them as a choice at all.
  const availableBottles = useMemo(() => bottles.filter((b) => b.stock > 0), [bottles]);

  const [selectedId, setSelectedId] = useState<string | undefined>(availableBottles[0]?.bottleId);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  const selected = availableBottles.find((b) => b.bottleId === selectedId);
  const stock = selected?.stock ?? 0;
  const priceDollars = selected ? selected.priceCents / 100 : 0;
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

  useEffect(() => {
    if (isPickerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isPickerOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPickerOpen) setIsPickerOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isPickerOpen]);

  function openPicker() {
    setSearch("");
    setIsPickerOpen(true);
  }

  function chooseBottle(bottleId: string) {
    setSelectedId(bottleId);
    setIsPickerOpen(false);
  }

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
      setAddToCartMessage("Added to cart!");
      setTimeout(() => {
        setAddToCartMessage("");
        setIsAddingToCart(false);
      }, 1500);
    } else {
      setAddToCartMessage("Cannot add more - stock limit reached");
      setTimeout(() => {
        setAddToCartMessage("");
        setIsAddingToCart(false);
      }, 2500);
    }
  };

  const handleBuyNow = async () => {
    if (!canBuy || !selected) return;
    setIsBuying(true);
    const success = addItem(buildCartItem(selected));
    if (success) {
      window.location.href = "/cart";
    } else {
      await showAlert("Cannot add more - stock limit reached", "Error");
      setIsBuying(false);
    }
  };

  if (availableBottles.length === 0) {
    return (
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-900">
          <strong>Out of stock.</strong> Check back soon, or contact us for availability.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="text-sm font-medium mb-2">Choose your bottle</div>

      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center gap-3 rounded-xl border-2 border-[var(--color-line)] hover:border-[var(--color-ink)] transition p-3 text-left"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 shrink-0 flex items-center justify-center">
          {selected?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.imageUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[9px] text-neutral-400">No photo</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{selected?.name ?? "Select a bottle"}</div>
          <div className="text-xs text-[var(--color-muted)]">
            {availableBottles.length} bottle{availableBottles.length === 1 ? "" : "s"} available
          </div>
        </div>
        <span className="text-sm font-medium text-[var(--color-accent)] shrink-0">Change</span>
      </button>

      <p className="mt-4 text-xl font-medium">${priceDollars.toFixed(2)}</p>

      <p className="mt-1 text-sm">
        {stock === 1 ? (
          <span className="text-rose-600 font-medium">Only {stock} left — almost gone</span>
        ) : (
          <span className="text-[var(--color-muted)]">{stock} in stock</span>
        )}
        {currentQuantityInCart > 0 && (
          <span className="ml-2 text-xs text-[var(--color-muted)]">({currentQuantityInCart} in cart)</span>
        )}
      </p>

      {addToCartMessage && (
        <p className={`mt-2 text-sm font-medium ${addToCartMessage.includes("Cannot") ? "text-rose-600" : "text-green-600"}`}>
          {addToCartMessage}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!canBuy || remainingStock <= 0 || isAddingToCart}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
          border-2 !border-[var(--color-accent)]
          text-[var(--color-accent)]
          hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)]
          transition
          ${!canBuy || remainingStock <= 0 || isAddingToCart ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {!isAddingToCart && <ShoppingCart className="w-4 h-4" />}
          {isAddingToCart
            ? "Adding..."
            : remainingStock <= 0 && currentQuantityInCart > 0
              ? "Max in Cart"
              : "Add to Cart"}
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

      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsPickerOpen(false)}
          />
          <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-line)] shrink-0">
              <h3 className="text-base font-semibold">Choose your bottle</h3>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-2 rounded-lg hover:bg-neutral-100 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[var(--color-line)] shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bottles..."
                  autoFocus
                  className="input !pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredBottles.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)] text-center py-8">
                  No bottles match &ldquo;{search}&rdquo;
                </p>
              ) : (
                <div className="space-y-5">
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
                              onClick={() => chooseBottle(b.bottleId)}
                              className={`relative rounded-xl border-2 p-2 text-left transition ${
                                isSelected
                                  ? "border-[var(--color-accent)] bg-[var(--color-mist)]"
                                  : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                              }`}
                            >
                              <div className="aspect-square rounded-lg overflow-hidden bg-neutral-100 mb-2">
                                {b.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={b.imageUrl} alt={b.name} className="w-full h-full object-contain" />
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
          </div>
        </div>
      )}
    </div>
  );
}
