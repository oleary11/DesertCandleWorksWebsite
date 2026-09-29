"use client";

import { useState } from "react";
import { Bell, Check, ShoppingBag } from "lucide-react";
import type { Product, ProductVariant, VariantConfig } from "@/lib/productsStore";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { trackEvent } from "@/components/AnalyticsTracker";
import { useVariantSelection } from "@/components/shop/useVariantSelection";
import VariantOptions, { StockLine } from "@/components/shop/VariantOptions";
import RestockRequestDialog from "@/components/shop/RestockRequestDialog";
import { btnPrimary, btnSecondary, money } from "@/components/shop/styles";

type Props = {
  product: Product;
  variants: ProductVariant[];
  globalScents: GlobalScent[];
  /** Kept for compatibility; the variant config is read from the product. */
  variantConfig?: VariantConfig;
};

export default function ProductVariantForm({ product, variants, globalScents }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const v = useVariantSelection(product, variants, globalScents);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [buying, setBuying] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const maxedOut = v.canBuy && v.remaining <= 0;

  function add(goToCart: boolean) {
    const item = v.cartItem();
    if (!item) return;
    if (goToCart) setBuying(true);
    if (addItem(item)) {
      trackEvent("cart_add", {
        productSlug: product.slug,
        productName: product.name,
        variantId: item.variantId,
        priceCents: Math.round(item.price * 100),
      });
      if (goToCart) {
        window.location.href = "/cart";
        return;
      }
      setFeedback({ ok: true, text: `Added: ${[item.sizeName, item.wickTypeName, item.scentName].filter(Boolean).join(" · ")}` });
      setTimeout(() => setFeedback(null), 3500);
    } else {
      setBuying(false);
      setFeedback({ ok: false, text: "You already have all we have of this one in your cart." });
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  const variantRows = variants.filter((variant) => v.productScents.some((s) => s.id === variant.scent));

  return (
    <div className="space-y-7">
      <VariantOptions v={v} />

      <div className="space-y-3 border-t border-[var(--home-line)] pt-6">
        <div className="flex items-end justify-between gap-4">
          <StockLine v={v} />
          <p className="text-2xl font-semibold tabular-nums text-[var(--home-ink)]">{money(v.price)}</p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className={btnPrimary} onClick={() => add(false)} disabled={!v.canBuy || maxedOut}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {maxedOut ? "All in your cart" : "Add to cart"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => add(true)} disabled={!v.canBuy || maxedOut || buying}>
            {buying ? "Taking you to your cart…" : "Buy now"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowRequest(true)}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--home-clay)] underline decoration-[var(--home-clay)]/30 underline-offset-4 hover:decoration-[var(--home-clay)]"
        >
          <Bell className="h-4 w-4" aria-hidden />
          Want a different scent or wick? Get notified
        </button>
      </div>

      <details className="group rounded-2xl bg-white/60 px-4 open:bg-white/80">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--home-ink)] [&::-webkit-details-marker]:hidden">
          Stock for every combination
          <span className="text-[var(--home-muted)] transition-transform group-open:rotate-45" aria-hidden>
            +
          </span>
        </summary>
        <div className="-mx-1 overflow-x-auto pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--home-line)] text-left text-xs uppercase tracking-wide text-[var(--home-muted)]">
                {v.hasSizes && <th className="px-1 py-2 font-medium">Size</th>}
                <th className="px-1 py-2 font-medium">Wick</th>
                <th className="px-1 py-2 font-medium">Scent</th>
                <th className="px-1 py-2 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {variantRows.map((variant) => (
                <tr key={variant.id} className="border-b border-[var(--home-line)]/60 last:border-0">
                  {v.hasSizes && <td className="px-1 py-2">{v.sizes.find((s) => s.id === variant.size)?.name ?? variant.size}</td>}
                  <td className="px-1 py-2">{v.wickTypes.find((w) => w.id === variant.wickType)?.name ?? variant.wickType}</td>
                  <td className="px-1 py-2">{v.productScents.find((s) => s.id === variant.scent)?.name ?? variant.scent}</td>
                  <td className="px-1 py-2 text-right tabular-nums">
                    {variant.stock <= 0 ? (
                      <span className="text-[#a8958a]">Sold out</span>
                    ) : variant.stock === 1 ? (
                      <span className="font-medium text-[#9b3b2a]">1</span>
                    ) : (
                      variant.stock
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Phone: keep the add button in reach while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--home-line)] bg-[var(--home-cream)]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgb(63_42_33/0.3)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[var(--home-muted)]">{[v.size?.name, v.wick?.name, v.scent?.name].filter(Boolean).join(" · ")}</p>
            <p className="font-semibold tabular-nums text-[var(--home-ink)]">{money(v.price)}</p>
          </div>
          <button type="button" className={`${btnPrimary} flex-1`} onClick={() => add(false)} disabled={!v.canBuy || maxedOut}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {maxedOut ? "In cart" : "Add to cart"}
          </button>
        </div>
      </div>

      {showRequest && (
        <RestockRequestDialog
          productName={product.name}
          wickTypes={v.wickTypes}
          scents={v.productScents}
          onClose={() => setShowRequest(false)}
        />
      )}
    </div>
  );
}
