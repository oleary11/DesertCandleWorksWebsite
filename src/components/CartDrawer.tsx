"use client";

import { useCartStore } from "@/lib/cartStore";
import Image from "next/image";
import Link from "next/link";
import { X, Trash2, Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import FreeShippingBanner from "./FreeShippingBanner";
import { useModal } from "@/hooks/useModal";
import PromoCodeField from "./PromoCodeField";
import { trackEvent } from "@/components/AnalyticsTracker";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { showAlert } = useModal();
  const { items, removeItem, updateQuantity, getTotalPrice } = useCartStore();
  const [itemToRemove, setItemToRemove] = useState<{ slug: string; variantId?: string; name: string } | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [appliedPromoId, setAppliedPromoId] = useState<string | null>(null);
  const [discountAmountCents, setDiscountAmountCents] = useState(0);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleRemoveItem = (slug: string, variantId: string | undefined, name: string) => {
    setItemToRemove({ slug, variantId, name });
  };

  const confirmRemove = () => {
    if (itemToRemove) {
      removeItem(itemToRemove.slug, itemToRemove.variantId);
      setItemToRemove(null);
    }
  };

  const handleQuantityChange = (slug: string, newQuantity: number, variantId: string | undefined, currentQuantity: number, itemName: string) => {
    if (currentQuantity === 1 && newQuantity === 0) {
      handleRemoveItem(slug, variantId, itemName);
    } else {
      updateQuantity(slug, newQuantity, variantId);
    }
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);

    try {
      const lineItems = items.map(item => ({
        price: item.stripePriceId,
        quantity: item.quantity,
        metadata: {
          productName: item.productName,
          productImage: item.productImage,
          sizeName: item.sizeName,
          wickType: item.wickTypeName,
          scent: item.scentName,
          variantId: item.variantId,
        },
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems,
          promotionId: appliedPromoId, // Pass validated promo ID
        }),
      });

      const data = await res.json();

      if (data.url) {
        trackEvent("checkout_started", { itemCount: items.length });
        window.location.href = data.url;
      } else {
        await showAlert(data.error || "Failed to create checkout session", "Error");
        setIsCheckingOut(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      await showAlert("An error occurred during checkout", "Error");
      setIsCheckingOut(false);
    }
  };

  const handlePromoApplied = (promotionId: string, discountAmount: number) => {
    setAppliedPromoId(promotionId);
    setDiscountAmountCents(discountAmount);
  };

  const handlePromoRemoved = () => {
    setAppliedPromoId(null);
    setDiscountAmountCents(0);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Shopping Cart</h2>
            <span className="text-sm text-[var(--color-muted)]">({items.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 transition"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <ShoppingBag className="w-16 h-16 text-[var(--color-muted)] mb-4" />
            <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
            <p className="text-sm text-[var(--color-muted)] mb-6">
              Add some candles to get started!
            </p>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
              [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
              text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
              hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] transition"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Free Shipping Banner */}
              <FreeShippingBanner currentTotal={getTotalPrice()} threshold={100} />

              {/* Items */}
              {items.map((item) => (
                <div
                  key={`${item.productSlug}-${item.variantId || ""}`}
                  className="border border-[var(--color-line)] rounded-lg p-3"
                >
                  <div className="flex gap-3">
                    {/* Image */}
                    {item.productImage && (
                      <Link
                        href={`/shop/${item.productSlug}`}
                        onClick={onClose}
                        className="relative w-16 h-16 flex-shrink-0"
                      >
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          fill
                          className="object-cover rounded-lg"
                        />
                      </Link>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/shop/${item.productSlug}`}
                        onClick={onClose}
                        className="font-medium hover:underline text-sm block truncate"
                      >
                        {item.productName}
                      </Link>
                      {item.variantId && (
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {item.wickTypeName && `${item.wickTypeName}`}
                          {item.scentName && ` • ${item.scentName}`}
                        </p>
                      )}
                      <p className="text-sm font-medium mt-1">${item.price.toFixed(2)}</p>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemoveItem(item.productSlug, item.variantId, item.productName)}
                      className="p-1.5 text-[var(--color-muted)] hover:text-rose-600 transition self-start"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() =>
                        handleQuantityChange(
                          item.productSlug,
                          item.quantity - 1,
                          item.variantId,
                          item.quantity,
                          item.productName
                        )
                      }
                      className="p-1.5 rounded-lg border border-[var(--color-line)] hover:bg-neutral-50 transition"
                      aria-label="Decrease"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateQuantity(item.productSlug, item.quantity + 1, item.variantId)
                      }
                      disabled={item.quantity >= item.maxStock}
                      className="p-1.5 rounded-lg border border-[var(--color-line)] hover:bg-neutral-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Increase"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {item.quantity >= item.maxStock && (
                      <span className="text-xs text-amber-600 ml-1">Max</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--color-line)] p-4 space-y-3">
              {/* Promo Code Field */}
              <div className="pb-3 border-b border-[var(--color-line)]">
                <PromoCodeField
                  onPromoApplied={handlePromoApplied}
                  onPromoRemoved={handlePromoRemoved}
                  subtotalCents={Math.round(getTotalPrice() * 100)}
                />
              </div>

              {/* Subtotal */}
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-[var(--color-muted)]">Subtotal</span>
                <span className="text-lg font-semibold">${getTotalPrice().toFixed(2)}</span>
              </div>

              {/* Discount (if applied) */}
              {discountAmountCents > 0 && (
                <div className="flex justify-between items-baseline text-green-600">
                  <span className="text-sm">Discount</span>
                  <span className="text-sm font-medium">-${(discountAmountCents / 100).toFixed(2)}</span>
                </div>
              )}

              {/* Estimated Total */}
              {discountAmountCents > 0 && (
                <div className="flex justify-between items-baseline pt-2 border-t border-[var(--color-line)]">
                  <span className="text-sm font-medium">Estimated Total</span>
                  <span className="text-lg font-semibold">
                    ${((getTotalPrice() * 100 - discountAmountCents) / 100).toFixed(2)}
                  </span>
                </div>
              )}

              <p className="text-xs text-[var(--color-muted)]">
                Shipping and taxes calculated at checkout
              </p>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-medium
                [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
                hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] transition
                disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? "Processing..." : "Checkout"}
                {!isCheckingOut && <ArrowRight className="w-4 h-4" />}
              </button>

              {/* Continue Shopping */}
              <button
                onClick={onClose}
                className="w-full text-center text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition py-2"
              >
                Continue Shopping
              </button>

              {/* View Full Cart */}
              <Link
                href="/cart"
                onClick={onClose}
                className="block text-center text-sm text-[var(--color-accent)] hover:underline py-2"
              >
                View Full Cart
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Remove Confirmation Modal */}
      {itemToRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setItemToRemove(null)}
          />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Remove Item?</h3>
            <p className="text-sm text-[var(--color-muted)] mb-6">
              Remove <strong>{itemToRemove.name}</strong> from your cart?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setItemToRemove(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-line)] hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
