"use client";

import { useMemo, useState } from "react";
import { Check, ShoppingBag, Wine } from "lucide-react";
import { useCartStore } from "@/lib/cartStore";
import { trackEvent } from "@/components/AnalyticsTracker";
import ShopDialog from "@/components/shop/ShopDialog";
import BottleGrid, { bottleCartItem } from "@/components/shop/BottleGrid";
import { btnPrimary, btnSecondary, labelClass, money } from "@/components/shop/styles";

export type BottlePickerOption = {
  bottleId: string;
  name: string;
  imageUrl?: string;
  priceCents: number;
  stock: number;
  alcoholType?: string; // groups the picker into sections; bottles arrive pre-sorted by type
};

type Props = {
  productSlug: string;
  productName: string;
  bottles: BottlePickerOption[];
};

export default function HomeGoodsBottlePicker({ productSlug, productName, bottles }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  // Sold-out bottles aren't a choice at all.
  const available = useMemo(() => bottles.filter((b) => b.stock > 0), [bottles]);

  const [selectedId, setSelectedId] = useState<string | undefined>(available[0]?.bottleId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = available.find((b) => b.bottleId === selectedId);
  const inCart = useCartStore((state) => (selected ? state.getItemQuantity(productSlug, selected.bottleId) : 0));
  const maxedOut = !!selected && selected.stock - inCart <= 0;

  function add(goToCart: boolean) {
    if (!selected) return;
    if (goToCart) setBuying(true);
    if (addItem(bottleCartItem(productSlug, productName, selected))) {
      trackEvent("cart_add", {
        productSlug,
        productName: `${productName} — ${selected.name}`,
        priceCents: selected.priceCents,
      });
      if (goToCart) {
        window.location.href = "/cart";
        return;
      }
      setFeedback({ ok: true, text: `Added: ${selected.name}` });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setBuying(false);
      setFeedback({ ok: false, text: "You already have this bottle in your cart." });
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  if (available.length === 0) {
    return (
      <p className="rounded-2xl bg-[var(--home-peach)] px-5 py-4 text-[15px] text-[var(--home-ink)]">
        <span className="font-semibold">Every bottle is spoken for.</span> Check back soon, or get in touch about a custom piece.
      </p>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <p className={`${labelClass} flex items-baseline justify-between`}>
          Your bottle
          <span className="text-sm font-normal text-[var(--home-muted)]">
            {available.length} {available.length === 1 ? "bottle" : "bottles"} to choose from
          </span>
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          className="flex w-full items-center gap-4 rounded-2xl bg-white p-3 text-left ring-1 ring-[var(--home-line)] transition-colors hover:ring-[var(--home-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)]"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--home-sand)]">
            {selected?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote bottle photos from any host
              <img src={selected.imageUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <Wine className="h-7 w-7 text-[#c9b3a2]" strokeWidth={1.5} aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-[var(--home-ink)]">{selected?.name ?? "Choose a bottle"}</span>
            {selected?.alcoholType && <span className="block text-sm text-[var(--home-muted)]">{selected.alcoholType}</span>}
          </span>
          <span className="shrink-0 text-sm font-semibold text-[var(--home-clay)]">Change</span>
        </button>
      </div>

      <div className="space-y-3 border-t border-[var(--home-line)] pt-6">
        <div className="flex items-end justify-between gap-4">
          <p className="text-sm" aria-live="polite">
            {selected?.stock === 1 ? (
              <span className="font-medium text-[#9b3b2a]">One of a kind</span>
            ) : (
              <span className="text-[var(--home-muted)]">In stock</span>
            )}
            {inCart > 0 && <span className="text-[var(--home-muted)]"> · in your cart</span>}
          </p>
          {selected && <p className="text-2xl font-semibold tabular-nums text-[var(--home-ink)]">{money(selected.priceCents / 100)}</p>}
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
          <button type="button" className={btnPrimary} onClick={() => add(false)} disabled={!selected || maxedOut}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {maxedOut ? "In your cart" : "Add to cart"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => add(true)} disabled={!selected || maxedOut || buying}>
            {buying ? "Taking you to your cart…" : "Buy now"}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <ShopDialog size="lg" title="Choose your bottle" subtitle={productName} onClose={() => setPickerOpen(false)}>
          <BottleGrid
            bottles={available}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setPickerOpen(false);
            }}
          />
        </ShopDialog>
      )}
    </div>
  );
}
