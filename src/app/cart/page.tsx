"use client";

import { useCartStore } from "@/lib/cartStore";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Minus, Plus, Tag, X, ShoppingBag, Truck, Lock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/hooks/useModal";
import { trackEvent } from "@/components/AnalyticsTracker";
import s from "@/components/home/home.module.css";
import { serif } from "@/lib/storefrontFonts";
import ShopDialog from "@/components/shop/ShopDialog";
import { btnPrimary, btnQuiet, fieldClass, labelClass, money } from "@/components/shop/styles";

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
  const [confirmClear, setConfirmClear] = useState(false);
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
          productSlug: item.productSlug,
          productType: item.productType,
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
        trackEvent("checkout_started", { itemCount: items.length });
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

  // Calculate discount amount based on points (1 point = $0.05)
  const maxPointsForDiscount = Math.max(
    0,
    Math.min(
      user?.points || 0, // Can't use more points than user has
      Math.floor((getTotalPrice() * 100) / 5) // Can't discount more than the order total
    )
  );

  const discountAmount = (pointsToRedeem * 5) / 100; // Convert points to dollars (1 point = $0.05)

  const subtotal = getTotalPrice();
  const total = Math.max(0, subtotal - getDiscountAmount() - discountAmount + getShippingCost());
  const activePromo = getActivePromotion();
  const addressComplete = !!(
    shippingAddress.name &&
    shippingAddress.line1 &&
    shippingAddress.city &&
    shippingAddress.state &&
    shippingAddress.postalCode
  );
  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const itemCount = items.reduce((n, item) => n + item.quantity, 0);

  function setAddress(field: keyof typeof shippingAddress, value: string) {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  }

  if (items.length === 0) {
    return (
      <div className={`${s.page} s-ui`}>
        <section className={`${s.cream} flex min-h-[60dvh] flex-col items-center justify-center px-6 py-20 text-center`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--home-peach)] text-[var(--home-clay)]">
            <ShoppingBag className="h-7 w-7" strokeWidth={1.6} aria-hidden />
          </span>
          <h1 className={`${serif.className} mt-6 text-4xl text-[var(--home-ink)]`}>Your cart is empty</h1>
          <p className="mt-3 max-w-sm text-[16px] text-[var(--home-muted)]">
            Nothing in here yet. Find a bottle you love and it&apos;ll wait for you here.
          </p>
          <Link href="/shop" className={`${btnPrimary} mt-8`}>
            Shop candles
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className={`${s.page} s-ui`}>
      {/* Full-screen loading overlay while Stripe prepares checkout */}
      {isCheckingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(63_42_33/0.45)] px-6" role="alertdialog" aria-modal="true" aria-labelledby="checkout-wait">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-[var(--home-cream)] px-10 py-8 text-center shadow-2xl">
            <span className="h-11 w-11 rounded-full border-4 border-[var(--home-clay)] border-t-transparent motion-safe:animate-spin" aria-hidden />
            <p id="checkout-wait" className={`${serif.className} text-xl text-[var(--home-ink)]`}>
              Preparing your checkout…
            </p>
            <p className="text-sm text-[var(--home-muted)]">This can take a moment.</p>
          </div>
        </div>
      )}

      <section className={`${s.cream} px-6 pb-20 pt-10 sm:pt-14`}>
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--home-clay)]">Your cart</p>
              <h1 className={`${serif.className} mt-2 text-4xl text-[var(--home-ink)] sm:text-5xl`}>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </h1>
            </div>
            <button type="button" onClick={() => setConfirmClear(true)} className="min-h-11 text-sm font-medium text-[var(--home-muted)] underline-offset-4 hover:text-[#9b3b2a] hover:underline">
              Clear cart
            </button>
          </div>

          <div className="mt-8 grid items-start gap-10 lg:grid-cols-12">
            {/* Items */}
            <div className="lg:col-span-7">
              <div className={`rounded-2xl px-5 py-4 ${hasFreeShipping ? "bg-[var(--home-sage)]" : "bg-[var(--home-peach)]"}`}>
                <p className="flex items-center gap-2 text-sm text-[var(--home-ink)]">
                  <Truck className="h-4 w-4 shrink-0 text-[var(--home-clay)]" aria-hidden />
                  {hasFreeShipping ? (
                    <span>
                      <span className="font-semibold">Free shipping unlocked.</span> Standard shipping is on us.
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold tabular-nums">{money(FREE_SHIPPING_THRESHOLD - subtotal)}</span> away from free shipping
                    </span>
                  )}
                </p>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70"
                  role="progressbar"
                  aria-label="Progress to free shipping"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(shippingProgress)}
                >
                  <div className="h-full rounded-full bg-[var(--home-clay)] transition-[width] duration-500" style={{ width: `${shippingProgress}%` }} />
                </div>
              </div>

              <ul className="mt-6 divide-y divide-[var(--home-line)] border-y border-[var(--home-line)]">
                {items.map((item) => {
                  const details = [item.sizeName, item.wickTypeName, item.scentName].filter(Boolean).join(" · ");
                  const atMax = item.quantity >= item.maxStock;
                  return (
                    <li key={`${item.productSlug}-${item.variantId || ""}`} className="flex gap-4 py-5 sm:gap-5">
                      <Link
                        href={`/shop/${item.productSlug}`}
                        className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#efe3d6] sm:h-28 sm:w-24"
                        tabIndex={-1}
                        aria-hidden
                      >
                        {item.productImage && <Image src={item.productImage} alt="" fill className="object-cover" sizes="96px" />}
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/shop/${item.productSlug}`}
                              className={`${serif.className} block text-[17px] leading-snug text-[var(--home-ink)] hover:text-[var(--home-clay)]`}
                            >
                              {item.productName}
                            </Link>
                            {details && <p className="mt-1 text-sm text-[var(--home-muted)]">{details}</p>}
                          </div>
                          <p className="shrink-0 font-semibold tabular-nums text-[var(--home-ink)]">{money(item.price * item.quantity)}</p>
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center rounded-full bg-white ring-1 ring-[var(--home-line)]">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.productSlug, item.quantity - 1, item.variantId, item.quantity, item.productName)}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--home-ink)] hover:bg-[var(--home-sand)]"
                                aria-label={`Decrease quantity of ${item.productName}`}
                              >
                                <Minus className="h-4 w-4" aria-hidden />
                              </button>
                              <span className="w-8 text-center text-sm font-semibold tabular-nums text-[var(--home-ink)]" aria-live="polite">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productSlug, item.quantity + 1, item.variantId)}
                                disabled={atMax}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--home-ink)] hover:bg-[var(--home-sand)] disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label={`Increase quantity of ${item.productName}`}
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                            {atMax && <span className="text-xs text-[var(--home-muted)]">That&apos;s all we have</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productSlug, item.variantId, item.productName)}
                            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-[var(--home-muted)] hover:bg-[#f7e1da] hover:text-[#9b3b2a]"
                            aria-label={`Remove ${item.productName}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Link href="/shop" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--home-clay)] hover:underline">
                ← Keep shopping
              </Link>
            </div>

            {/* Summary + checkout */}
            <div className="lg:sticky lg:top-28 lg:col-span-5">
              <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgb(63_42_33/0.06),0_20px_44px_-28px_rgb(63_42_33/0.4)] ring-1 ring-[var(--home-line)] sm:p-7">
                <h2 className={`${serif.className} text-2xl text-[var(--home-ink)]`}>Order summary</h2>

                {/* Promo code */}
                <div className="mt-5 border-b border-[var(--home-line)] pb-5">
                  {activePromo ? (
                    <div className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--home-sage)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--home-ink)]">
                          <Tag className="h-4 w-4 text-[#4d6a3a]" aria-hidden />
                          <span className="font-mono font-semibold">{activePromo.code}</span>
                          {!appliedPromotion && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">Applied automatically</span>}
                        </p>
                        <p className="mt-1 text-xs text-[var(--home-muted)]">{activePromo.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={removePromotion}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-ink)] hover:bg-white/60"
                        aria-label={`Remove promo code ${activePromo.code}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        applyPromoCode();
                      }}
                    >
                      <label htmlFor="promo-code" className={labelClass}>
                        Promo code
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="promo-code"
                          type="text"
                          className={`${fieldClass} flex-1 uppercase placeholder:normal-case`}
                          placeholder="Enter code"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          disabled={applyingPromo}
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={!!promoError}
                          aria-describedby={promoError ? "promo-error" : undefined}
                        />
                        <button type="submit" disabled={!promoCode.trim() || applyingPromo} className={btnQuiet}>
                          {applyingPromo ? "Checking…" : "Apply"}
                        </button>
                      </div>
                      {promoError && (
                        <p id="promo-error" role="alert" className="mt-2 text-sm text-[#9b3b2a]">
                          {promoError}
                        </p>
                      )}
                    </form>
                  )}
                </div>

                {/* Totals */}
                <dl className="space-y-2.5 border-b border-[var(--home-line)] py-5 text-[15px]">
                  <div className="flex justify-between">
                    <dt className="text-[var(--home-muted)]">Subtotal</dt>
                    <dd className="tabular-nums text-[var(--home-ink)]">{money(subtotal)}</dd>
                  </div>
                  {activePromo && (
                    <div className="flex justify-between text-[#4d6a3a]">
                      <dt>Promotion{activePromo.discountPercent ? ` (${activePromo.discountPercent}% off)` : ""}</dt>
                      <dd className="tabular-nums">−{money(getDiscountAmount())}</dd>
                    </div>
                  )}
                  {pointsToRedeem > 0 && (
                    <div className="flex justify-between text-[#4d6a3a]">
                      <dt>Points</dt>
                      <dd className="tabular-nums">−{money(discountAmount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-[var(--home-muted)]">Shipping</dt>
                    <dd className="text-[var(--home-ink)]">{hasFreeShipping ? "Free" : "Calculated at checkout"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--home-muted)]">Tax</dt>
                    <dd className="text-[var(--home-ink)]">Calculated at checkout</dd>
                  </div>
                </dl>

                {/* Points */}
                {user && user.points > 0 && (
                  <div className="border-b border-[var(--home-line)] py-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor="points" className="text-sm font-semibold text-[var(--home-ink)]">
                        Use your points
                      </label>
                      <span className="text-xs text-[var(--home-muted)]">
                        {user.points.toLocaleString()} available ({money((user.points * 5) / 100)})
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="points"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={maxPointsForDiscount}
                        value={pointsToRedeem}
                        onChange={(e) => setPointsToRedeem(Math.max(0, Math.min(Math.floor(Number(e.target.value) || 0), maxPointsForDiscount)))}
                        className={`${fieldClass} flex-1`}
                        aria-describedby="points-hint"
                      />
                      <button type="button" onClick={() => setPointsToRedeem(maxPointsForDiscount)} className={btnQuiet}>
                        Use max
                      </button>
                    </div>
                    <p id="points-hint" className="mt-2 text-xs text-[var(--home-muted)]">
                      100 points = $5.00 off
                    </p>
                  </div>
                )}

                <div className="flex items-baseline justify-between py-5">
                  <span className="font-semibold text-[var(--home-ink)]">Total</span>
                  <span className="text-2xl font-semibold tabular-nums text-[var(--home-ink)]">{money(total)}</span>
                </div>

                {/* Shipping address */}
                <div className="border-t border-[var(--home-line)] pt-5">
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className={`${serif.className} text-lg text-[var(--home-ink)]`}>Shipping address</legend>
                  <p className="mt-1 text-sm text-[var(--home-muted)]">You&apos;ll choose delivery or free local pickup on the next step.</p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label htmlFor="ship-name" className="mb-1 block text-sm text-[var(--home-ink)]">
                        Full name
                      </label>
                      <input id="ship-name" type="text" autoComplete="shipping name" value={shippingAddress.name} onChange={(e) => setAddress("name", e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label htmlFor="ship-line1" className="mb-1 block text-sm text-[var(--home-ink)]">
                        Street address
                      </label>
                      <input id="ship-line1" type="text" autoComplete="shipping address-line1" value={shippingAddress.line1} onChange={(e) => setAddress("line1", e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label htmlFor="ship-line2" className="mb-1 block text-sm text-[var(--home-ink)]">
                        Apt, suite, etc. <span className="text-[var(--home-muted)]">(optional)</span>
                      </label>
                      <input id="ship-line2" type="text" autoComplete="shipping address-line2" value={shippingAddress.line2} onChange={(e) => setAddress("line2", e.target.value)} className={fieldClass} />
                    </div>
                    <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                      <div>
                        <label htmlFor="ship-city" className="mb-1 block text-sm text-[var(--home-ink)]">
                          City
                        </label>
                        <input id="ship-city" type="text" autoComplete="shipping address-level2" value={shippingAddress.city} onChange={(e) => setAddress("city", e.target.value)} className={fieldClass} />
                      </div>
                      <div>
                        <label htmlFor="ship-state" className="mb-1 block text-sm text-[var(--home-ink)]">
                          State
                        </label>
                        <select id="ship-state" autoComplete="shipping address-level1" value={shippingAddress.state} onChange={(e) => setAddress("state", e.target.value)} className={fieldClass}>
                          <option value="">—</option>
                          {US_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="max-w-[10rem]">
                      <label htmlFor="ship-zip" className="mb-1 block text-sm text-[var(--home-ink)]">
                        ZIP code
                      </label>
                      <input
                        id="ship-zip"
                        type="text"
                        inputMode="numeric"
                        autoComplete="shipping postal-code"
                        value={shippingAddress.postalCode}
                        onChange={(e) => setAddress("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                        className={fieldClass}
                        maxLength={5}
                      />
                    </div>
                  </div>
                </fieldset>
                </div>

                {!user && (
                  <p className="mt-5 rounded-2xl bg-[var(--home-sand)] px-4 py-3 text-sm text-[var(--home-ink)]">
                    <span className="font-semibold">Earn {Math.round(subtotal)} points</span> ({money((Math.round(subtotal) * 5) / 100)} toward a future order) with a free account.{" "}
                    <Link href="/account/register" className="font-semibold text-[var(--home-clay)] underline underline-offset-2">
                      Create one
                    </Link>
                  </p>
                )}

                <button type="button" onClick={handleCheckout} disabled={isCheckingOut || !addressComplete} className={`${btnPrimary} mt-6 w-full`}>
                  <Lock className="h-4 w-4" aria-hidden />
                  {isCheckingOut ? "Taking you to checkout…" : addressComplete ? "Continue to checkout" : "Enter your address to continue"}
                </button>
                <p className="mt-3 text-center text-xs text-[var(--home-muted)]">Secure checkout with Stripe</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {itemToRemove && (
        <ShopDialog
          title="Remove this item?"
          onClose={() => setItemToRemove(null)}
          footer={
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className={btnQuiet} onClick={() => setItemToRemove(null)}>
                Keep it
              </button>
              <button type="button" className={`${btnPrimary} !bg-[#9b3b2a] hover:!bg-[#7f2f21]`} onClick={confirmRemove}>
                Remove
              </button>
            </div>
          }
        >
          <p className="text-[15px] text-[var(--home-muted)]">
            <span className="font-semibold text-[var(--home-ink)]">{itemToRemove.name}</span> will be taken out of your cart.
          </p>
        </ShopDialog>
      )}

      {confirmClear && (
        <ShopDialog
          title="Clear your cart?"
          onClose={() => setConfirmClear(false)}
          footer={
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className={btnQuiet} onClick={() => setConfirmClear(false)}>
                Keep items
              </button>
              <button
                type="button"
                className={`${btnPrimary} !bg-[#9b3b2a] hover:!bg-[#7f2f21]`}
                onClick={() => {
                  clearCart();
                  setConfirmClear(false);
                }}
              >
                Clear cart
              </button>
            </div>
          }
        >
          <p className="text-[15px] text-[var(--home-muted)]">
            {itemCount === 1 ? "The item in your cart will be removed." : `All ${itemCount} items will be removed.`}
          </p>
        </ShopDialog>
      )}
    </div>
  );
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
  "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND",
  "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];
