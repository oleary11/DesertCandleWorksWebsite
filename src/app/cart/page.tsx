"use client";

import { useCartStore } from "@/lib/cartStore";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Minus, Plus } from "lucide-react";
import { useState } from "react";

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice } = useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ slug: string; variantId?: string; name: string } | null>(null);

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
    // If decrementing from 1 to 0, show confirmation
    if (currentQuantity === 1 && newQuantity === 0) {
      handleRemoveItem(slug, variantId, itemName);
    } else {
      updateQuantity(slug, newQuantity, variantId);
    }
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);

    try {
      // Build line items for Stripe
      const lineItems = items.map(item => ({
        price: item.stripePriceId,
        quantity: item.quantity,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        alert("Failed to create checkout session");
        setIsCheckingOut(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("An error occurred during checkout");
      setIsCheckingOut(false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center px-6 py-20">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
          <p className="text-[var(--color-muted)] mb-8">
            Looks like you haven&apos;t added any candles to your cart yet.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
            [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
            !text-white shadow-[0_2px_10px_rgba(20,16,12,0.1)]
            hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition"
          >
            Shop Candles
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <button
            onClick={clearCart}
            className="text-sm text-[var(--color-muted)] hover:text-rose-600 transition"
          >
            Clear Cart
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={`${item.productSlug}-${item.variantId || ""}`}
                className="card p-4 flex gap-4"
              >
                {/* Product Image */}
                {item.productImage && (
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Product Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/shop/${item.productSlug}`}
                    className="font-medium hover:underline block truncate"
                  >
                    {item.productName}
                  </Link>
                  {item.variantId && (
                    <p className="text-sm text-[var(--color-muted)] mt-1">
                      {item.wickTypeName && `${item.wickTypeName}`}
                      {item.scentName && ` • ${item.scentName}`}
                    </p>
                  )}
                  <p className="text-sm font-medium mt-2">${item.price.toFixed(2)}</p>
                </div>

                {/* Quantity Controls */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
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
                      className="p-1 rounded hover:bg-neutral-100 transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.productSlug,
                          item.quantity + 1,
                          item.variantId
                        )
                      }
                      disabled={item.quantity >= item.maxStock}
                      className="p-1 rounded hover:bg-neutral-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {item.quantity >= item.maxStock && (
                    <span className="text-xs text-amber-600">Max stock</span>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveItem(item.productSlug, item.variantId, item.productName)}
                  className="p-2 text-[var(--color-muted)] hover:text-rose-600 transition"
                  aria-label="Remove from cart"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              <div className="space-y-2 mb-4 pb-4 border-b border-[var(--color-line)]">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Subtotal</span>
                  <span className="font-medium">${getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Shipping</span>
                  <span className="font-medium">Calculated at checkout</span>
                </div>
              </div>

              <div className="flex justify-between text-lg font-semibold mb-6">
                <span>Total</span>
                <span>${getTotalPrice().toFixed(2)}</span>
              </div>

              {/* Shipping Info */}
              <div className="mb-6 p-3 bg-neutral-50 rounded-lg border border-[var(--color-line)]">
                <p className="text-xs font-medium text-[var(--color-ink)] mb-1">
                  Shipping Information
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  Orders typically ship within 2-3 business days. Local pickup available in Scottsdale, AZ.
                </p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium mb-3
                [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
                hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
                disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? "Processing..." : "Checkout"}
              </button>

              <Link
                href="/shop"
                className="block text-center text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {itemToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setItemToRemove(null)}
            />

            {/* Modal */}
            <div className="relative card max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-2">Remove Item?</h3>
              <p className="text-sm text-[var(--color-muted)] mb-6">
                Are you sure you want to remove <strong>{itemToRemove.name}</strong> from your cart?
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
      </div>
    </section>
  );
}
