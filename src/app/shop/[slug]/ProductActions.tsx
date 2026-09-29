"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cartStore";
import type { Product } from "@/lib/productsStore";
import { getPrimaryImage } from "@/lib/products";
import { trackEvent } from "@/components/AnalyticsTracker";
import RestockRequestDialog from "@/components/shop/RestockRequestDialog";
import { btnPrimary, btnSecondary, money } from "@/components/shop/styles";

type Props = {
  product: Product;
  stock: number;
};

/** Buy buttons for a product with no size, wick or scent choices. */
export default function ProductActions({ product, stock }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const inCart = useCartStore((state) => state.getItemQuantity(product.slug));
  const [buying, setBuying] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const canBuy = !!product.stripePriceId && stock > 0;
  const maxedOut = canBuy && stock - inCart <= 0;

  function add(goToCart: boolean) {
    if (!canBuy) return;
    if (goToCart) setBuying(true);
    const ok = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: getPrimaryImage(product),
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
    });
    if (ok) {
      trackEvent("cart_add", {
        productSlug: product.slug,
        productName: product.name,
        priceCents: Math.round(product.price * 100),
      });
      if (goToCart) {
        window.location.href = "/cart";
        return;
      }
      setFeedback({ ok: true, text: "Added to your cart" });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setBuying(false);
      setFeedback({ ok: false, text: "You already have all we have of this one in your cart." });
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm" aria-live="polite">
          {stock <= 0 ? (
            <span className="font-medium text-[#9b3b2a]">Sold out</span>
          ) : stock === 1 ? (
            <span className="font-medium text-[#9b3b2a]">Only 1 left</span>
          ) : (
            <span className="text-[var(--home-muted)]">In stock</span>
          )}
          {inCart > 0 && <span className="text-[var(--home-muted)]"> · {inCart} in your cart</span>}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-[var(--home-ink)]">{money(product.price)}</p>
      </div>

      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            feedback.ok ? "bg-[var(--home-sage)] text-[var(--home-ink)]" : "bg-[#f7e1da] text-[#7a2a1c]"
          }`}
        >
          {feedback.ok && <Check className="h-4 w-4 shrink-0 text-[#4d6a3a]" aria-hidden />}
          {feedback.text}
        </p>
      )}

      {stock > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className={btnPrimary} onClick={() => add(false)} disabled={!canBuy || maxedOut}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {maxedOut ? "All in your cart" : "Add to cart"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => add(true)} disabled={!canBuy || maxedOut || buying}>
            {buying ? "Taking you to your cart…" : "Buy now"}
          </button>
        </div>
      ) : (
        <button type="button" className={`${btnPrimary} w-full`} onClick={() => setShowRequest(true)}>
          Notify me when it&apos;s back
        </button>
      )}

      {showRequest && <RestockRequestDialog productName={product.name} onClose={() => setShowRequest(false)} />}
    </div>
  );
}
