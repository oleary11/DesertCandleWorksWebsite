"use client";

import { useCartStore } from "@/lib/cartStore";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Minus, Plus, Tag, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import FreeShippingBanner from "@/components/FreeShippingBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/hooks/useModal";

type AppliedPromotion = {
  id: string;
  code: string;
  name: string;
  type: string;
  discountPercent?: number;
  discountAmountCents?: number;
};

export default function CartPage() {
  const { showAlert } = useModal();
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice } = useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ slug: string; variantId?: string; name: string } | null>(null);
  const { user } = useAuth();
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Promotion state
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<AppliedPromotion | null>(null);
  const [automaticPromotion, setAutomaticPromotion] = useState<AppliedPromotion | null>(null);

  // Shipping state
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US"
  });

  // Free shipping threshold
  const FREE_SHIPPING_THRESHOLD = 100;
  const hasFreeShipping = getTotalPrice() >= FREE_SHIPPING_THRESHOLD;

  const checkAutomaticPromotions = useCallback(async () => {
    // Don't check if manual promo already applied
    if (appliedPromotion) return;
    if (items.length === 0) return;

    try {
      const cartItems = items.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
        priceCents: Math.round(item.price * 100),
      }));

      const res = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItems }),
      });

      const data = await res.json();

      if (data.valid && data.promotion) {
        setAutomaticPromotion(data.promotion);
      } else {
        setAutomaticPromotion(null);
      }
    } catch (err) {
      console.error("Failed to check automatic promotions:", err);
    }
  }, [appliedPromotion, items]);

  // Check for automatic promotions on cart change
  useEffect(() => {
    checkAutomaticPromotions();
  }, [checkAutomaticPromotions]);

  async function applyPromoCode() {
    if (!promoCode.trim()) return;

    setApplyingPromo(true);
    setPromoError("");

    try {
      const cartItems = items.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
        priceCents: Math.round(item.price * 100),
      }));

      const res = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.toUpperCase(), cartItems }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setPromoError(data.error || "Invalid promotion code");
        setApplyingPromo(false);
        return;
      }

      setAppliedPromotion(data.promotion);
      setAutomaticPromotion(null); // Clear automatic when manual applied
      setPromoCode("");
    } catch {
      setPromoError("Failed to apply promotion");
    } finally {
      setApplyingPromo(false);
    }
  }

  function removePromotion() {
    setAppliedPromotion(null);
    setAutomaticPromotion(null);
    setPromoError("");
    // Don't auto-check for promotions after manual removal
    // User can manually apply a different code if they want
  }

  function getActivePromotion(): AppliedPromotion | null {
    return appliedPromotion || automaticPromotion;
  }

  function getDiscountAmount(): number {
    const activePromo = getActivePromotion();
    if (!activePromo) return 0;
    return (activePromo.discountAmountCents || 0) / 100;
  }

  function getShippingCost(): number {
    // Shipping cost will be calculated in Stripe
    if (hasFreeShipping) return 0; // Free shipping over $100
    // Show "TBD" by returning 0 for now - actual cost shown in Stripe
    return 0;
  }

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
    // Validation: Require full address
    if (!shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
      await showAlert("Please enter your complete shipping address", "Error");
      return;
    }

    setIsCheckingOut(true);

    try {
      // Build line items for Stripe with variant metadata
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

      const activePromo = getActivePromotion();

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems,
          pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
          promotionId: activePromo?.id,
          // Pass full shipping address - Stripe will show shipping options (including local pickup)
          shippingAddress,
        }),
      });

      const data = await res.json();

      if (data.error) {
        await showAlert(data.error, "Error");
        setIsCheckingOut(false);
        return;
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        await showAlert("Failed to create checkout session", "Error");
        setIsCheckingOut(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      await showAlert("An error occurred during checkout", "Error");
      setIsCheckingOut(false);
    }
  };

  // Calculate discount amount based on points
  const maxPointsForDiscount = Math.min(
    user?.points || 0, // Can't use more points than user has
    Math.floor(getTotalPrice() * 100) // Can't use more points than order total (in cents)
  );

  const discountAmount = (pointsToRedeem * 5) / 100; // Convert points to dollars (1 point = $0.05)

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
    <>
      {/* Full-screen loading overlay */}
      {isCheckingOut && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="animate-spin h-12 w-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full"></div>
            <p className="text-lg font-medium">Preparing your checkout...</p>
            <p className="text-sm text-[var(--color-muted)]">This may take a moment</p>
          </div>
        </div>
      )}

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

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Cart Items */}
          <div className="space-y-4">
            {/* Free Shipping Banner */}
            <FreeShippingBanner currentTotal={getTotalPrice()} threshold={100} />

            {items.map((item) => (
              <div
                key={`${item.productSlug}-${item.variantId || ""}`}
                className="card p-4"
              >
                <div className="flex gap-4">
                  {/* Product Image */}
                  {item.productImage && (
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
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
                      className="font-medium hover:underline block text-sm sm:text-base"
                    >
                      {item.productName}
                    </Link>
                    {item.variantId && (
                      <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                        {item.sizeName && `${item.sizeName}`}
                        {item.wickTypeName && `${item.sizeName ? ' • ' : ''}${item.wickTypeName}`}
                        {item.scentName && ` • ${item.scentName}`}
                      </p>
                    )}
                    <p className="text-sm font-medium mt-2">${item.price.toFixed(2)}</p>
                  </div>

                  {/* Remove Button (desktop) */}
                  <button
                    onClick={() => handleRemoveItem(item.productSlug, item.variantId, item.productName)}
                    className="hidden sm:block p-2 text-[var(--color-muted)] hover:text-rose-600 transition self-start"
                    aria-label="Remove from cart"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Quantity Controls and Remove (mobile) */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-line)]">
                  <div className="flex items-center gap-3">
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
                      className="p-2 rounded-lg border border-[var(--color-line)] hover:bg-neutral-50 transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.productSlug,
                          item.quantity + 1,
                          item.variantId
                        )
                      }
                      disabled={item.quantity >= item.maxStock}
                      className="p-2 rounded-lg border border-[var(--color-line)] hover:bg-neutral-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {item.quantity >= item.maxStock && (
                      <span className="text-xs text-amber-600 ml-2">Max</span>
                    )}
                  </div>

                  {/* Remove Button (mobile) */}
                  <button
                    onClick={() => handleRemoveItem(item.productSlug, item.variantId, item.productName)}
                    className="sm:hidden p-2 text-[var(--color-muted)] hover:text-rose-600 transition"
                    aria-label="Remove from cart"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div>
            <div className="card p-6 lg:sticky lg:top-24">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              {/* Promo Code Input */}
              <div className="mb-4 pb-4 border-b border-[var(--color-line)]">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Promo Code
                </label>

                {getActivePromotion() ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="font-mono font-bold text-sm">
                          {getActivePromotion()!.code}
                        </span>
                        {!appliedPromotion && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Auto-applied
                          </span>
                        )}
                      </div>
                      <button
                        onClick={removePromotion}
                        className="p-1 hover:bg-green-100 rounded transition"
                        title="Remove promo code"
                      >
                        <X className="w-4 h-4 text-green-600" />
                      </button>
                    </div>
                    <p className="text-xs text-green-700">{getActivePromotion()!.name}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1 text-sm uppercase"
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && applyPromoCode()}
                        disabled={applyingPromo}
                      />
                      <button
                        onClick={applyPromoCode}
                        disabled={!promoCode.trim() || applyingPromo}
                        className="btn btn-sm px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {applyingPromo ? "..." : "Apply"}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-xs text-rose-600 mt-2">{promoError}</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 mb-4 pb-4 border-b border-[var(--color-line)]">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Subtotal</span>
                  <span className="font-medium">${getTotalPrice().toFixed(2)}</span>
                </div>
                {getActivePromotion() && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>
                      Promotion
                      {getActivePromotion()!.discountPercent && ` (${getActivePromotion()!.discountPercent}% off)`}
                    </span>
                    <span className="font-medium">-${getDiscountAmount().toFixed(2)}</span>
                  </div>
                )}
                {pointsToRedeem > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Points Discount</span>
                    <span className="font-medium">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Shipping</span>
                  <span className="font-medium">
                    {hasFreeShipping ? "FREE" : "Calculated in checkout"}
                  </span>
                </div>
                {hasFreeShipping && (
                  <p className="text-xs text-green-600 pt-1">
                    🎉 You qualify for free shipping!
                  </p>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Tax</span>
                  <span className="font-medium">Calculated at checkout</span>
                </div>
              </div>

              {/* Points Redemption */}
              {user && user.points > 0 && (
                <div className="mb-4 pb-4 border-b border-[var(--color-line)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Redeem Points</span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {user.points.toLocaleString()} available (${((user.points * 5) / 100).toFixed(2)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min="0"
                      max={maxPointsForDiscount}
                      value={pointsToRedeem}
                      onChange={(e) => setPointsToRedeem(Math.min(Number(e.target.value), maxPointsForDiscount))}
                      className="input text-sm flex-1"
                      placeholder="0"
                    />
                    <button
                      onClick={() => setPointsToRedeem(maxPointsForDiscount)}
                      className="text-xs bg-[var(--color-accent)] text-white px-3 py-2 rounded-md hover:opacity-90 transition whitespace-nowrap"
                    >
                      Use Max
                    </button>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    100 points = $5.00 discount
                  </p>
                </div>
              )}

              <div className="flex justify-between text-lg font-semibold mb-6">
                <span>Total</span>
                <span>${(getTotalPrice() - getDiscountAmount() - discountAmount + getShippingCost()).toFixed(2)}</span>
              </div>

              {/* Shipping Address */}
              <div className="mb-6 pb-6 border-b border-[var(--color-line)]">
                <h3 className="text-sm font-semibold mb-3">Shipping Address</h3>
                <p className="text-xs text-[var(--color-muted)] mb-3">
                  You&apos;ll select your shipping method (including local pickup) in checkout
                </p>

                <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={shippingAddress.name}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                            className="input text-sm w-full"
                          />

                          <input
                            type="text"
                            placeholder="Address Line 1"
                            value={shippingAddress.line1}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                            className="input text-sm w-full"
                          />

                          <input
                            type="text"
                            placeholder="Address Line 2 (Optional)"
                            value={shippingAddress.line2}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                            className="input text-sm w-full"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="City"
                              value={shippingAddress.city}
                              onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                              className="input text-sm"
                            />

                            <select
                              value={shippingAddress.state}
                              onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                              className="input text-sm"
                            >
                              <option value="">State</option>
                              <option value="AL">AL</option>
                              <option value="AK">AK</option>
                              <option value="AZ">AZ</option>
                              <option value="AR">AR</option>
                              <option value="CA">CA</option>
                              <option value="CO">CO</option>
                              <option value="CT">CT</option>
                              <option value="DE">DE</option>
                              <option value="FL">FL</option>
                              <option value="GA">GA</option>
                              <option value="HI">HI</option>
                              <option value="ID">ID</option>
                              <option value="IL">IL</option>
                              <option value="IN">IN</option>
                              <option value="IA">IA</option>
                              <option value="KS">KS</option>
                              <option value="KY">KY</option>
                              <option value="LA">LA</option>
                              <option value="ME">ME</option>
                              <option value="MD">MD</option>
                              <option value="MA">MA</option>
                              <option value="MI">MI</option>
                              <option value="MN">MN</option>
                              <option value="MS">MS</option>
                              <option value="MO">MO</option>
                              <option value="MT">MT</option>
                              <option value="NE">NE</option>
                              <option value="NV">NV</option>
                              <option value="NH">NH</option>
                              <option value="NJ">NJ</option>
                              <option value="NM">NM</option>
                              <option value="NY">NY</option>
                              <option value="NC">NC</option>
                              <option value="ND">ND</option>
                              <option value="OH">OH</option>
                              <option value="OK">OK</option>
                              <option value="OR">OR</option>
                              <option value="PA">PA</option>
                              <option value="RI">RI</option>
                              <option value="SC">SC</option>
                              <option value="SD">SD</option>
                              <option value="TN">TN</option>
                              <option value="TX">TX</option>
                              <option value="UT">UT</option>
                              <option value="VT">VT</option>
                              <option value="VA">VA</option>
                              <option value="WA">WA</option>
                              <option value="WV">WV</option>
                              <option value="WI">WI</option>
                              <option value="WY">WY</option>
                            </select>
                          </div>

                  <input
                    type="text"
                    placeholder="ZIP Code"
                    value={shippingAddress.postalCode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    className="input text-sm w-full"
                    maxLength={5}
                  />
                </div>
              </div>

              {/* Guest Checkout - Encourage Account Creation */}
              {!user && (
                <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                      💡
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 mb-1">
                        Create an account to earn points!
                      </p>
                      <p className="text-xs text-amber-800 mb-2">
                        You&apos;ll earn <strong>{Math.round(getTotalPrice())} points</strong> (${((Math.round(getTotalPrice()) * 5) / 100).toFixed(2)} value) on this ${getTotalPrice().toFixed(2)} order.
                      </p>
                      <Link
                        href="/account/register"
                        className="inline-flex items-center text-xs font-medium text-amber-900 hover:text-amber-950 underline"
                      >
                        Sign up now →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={isCheckingOut || !shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode}
                className="w-full inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium mb-3
                [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
                hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
                disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut
                  ? "Processing..."
                  : (!shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode)
                    ? "Enter Shipping Address"
                    : "Checkout"
                }
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
    </>
  );
}
