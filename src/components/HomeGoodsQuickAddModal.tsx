"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cartStore";
import { trackEvent } from "@/components/AnalyticsTracker";
import type { BottlePickerOption } from "@/app/shop/[slug]/HomeGoodsBottlePicker";
import ShopDialog from "@/components/shop/ShopDialog";
import BottleGrid, { bottleCartItem } from "@/components/shop/BottleGrid";
import { btnPrimary, btnQuiet, money } from "@/components/shop/styles";

type Props = {
  productSlug: string;
  productName: string;
  bottles: BottlePickerOption[];
  onClose: () => void;
};

export default function HomeGoodsQuickAddModal({ productSlug, productName, bottles, onClose }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  // Sold-out bottles aren't a choice at all.
  const available = useMemo(() => bottles.filter((b) => b.stock > 0), [bottles]);
  const [selectedId, setSelectedId] = useState<string | undefined>(available[0]?.bottleId);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selected = available.find((b) => b.bottleId === selectedId);
  const inCart = useCartStore((state) => (selected ? state.getItemQuantity(productSlug, selected.bottleId) : 0));
  const remaining = (selected?.stock ?? 0) - inCart;

  function add() {
    if (!selected) return;
    setError("");
    if (addItem(bottleCartItem(productSlug, productName, selected))) {
      trackEvent("cart_add", {
        productSlug,
        productName: `${productName} — ${selected.name}`,
        priceCents: selected.priceCents,
      });
      setAdded(selected.name);
    } else {
      setError("You already have all we have of this bottle in your cart.");
    }
  }

  if (added) {
    return (
      <ShopDialog
        title="Added to your cart"
        onClose={onClose}
        footer={
          <div className="flex gap-2">
            <button type="button" className={`${btnQuiet} flex-1`} onClick={onClose}>
              Keep shopping
            </button>
            <Link href="/cart" className={`${btnPrimary} flex-1`}>
              View cart
            </Link>
          </div>
        }
      >
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-white p-4 text-[15px] text-[var(--home-ink)]">
          <Check className="h-5 w-5 shrink-0 text-[#4d6a3a]" aria-hidden />
          {productName} in a {added} bottle
        </p>
      </ShopDialog>
    );
  }

  return (
    <ShopDialog
      size="lg"
      title="Choose your bottle"
      subtitle={productName}
      onClose={onClose}
      footer={
        available.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate text-[var(--home-muted)]">
                {selected ? <span className="font-medium text-[var(--home-ink)]">{selected.name}</span> : "Pick a bottle"}
                {selected?.stock === 1 && <span className="text-[#9b3b2a]"> · Only 1 left</span>}
              </p>
              {selected && <p className="text-lg font-semibold tabular-nums text-[var(--home-ink)]">{money(selected.priceCents / 100)}</p>}
            </div>
            {error && (
              <p role="alert" className="text-sm text-[#9b3b2a]">
                {error}
              </p>
            )}
            <button type="button" className={`${btnPrimary} w-full`} onClick={add} disabled={!selected || remaining <= 0}>
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {selected && remaining <= 0 ? "All in your cart" : "Add to cart"}
            </button>
          </div>
        ) : undefined
      }
    >
      {available.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-[var(--home-muted)]">Every bottle is spoken for right now. Check back soon.</p>
      ) : (
        <BottleGrid bottles={available} selectedId={selectedId} onSelect={setSelectedId} />
      )}
    </ShopDialog>
  );
}
