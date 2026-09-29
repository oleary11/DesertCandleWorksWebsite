"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/productsStore";
import { getPrimaryImage } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { trackEvent } from "@/components/AnalyticsTracker";
import ShopDialog from "@/components/shop/ShopDialog";
import VariantOptions, { StockLine } from "@/components/shop/VariantOptions";
import { useVariantSelection } from "@/components/shop/useVariantSelection";
import { btnPrimary, btnQuiet, money } from "@/components/shop/styles";

type QuickAddModalProps = {
  product: Product & { _computedStock?: number };
  variants: ProductVariant[];
  globalScents: GlobalScent[];
  /** Kept for compatibility; wick types come from the product's variant config. */
  wickTypes?: Array<{ id: string; name: string }>;
  onClose: () => void;
};

export default function QuickAddModal({ product, variants, globalScents, onClose }: QuickAddModalProps) {
  const addItem = useCartStore((state) => state.addItem);
  const v = useVariantSelection(product, variants, globalScents);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const image = getPrimaryImage(product);

  function add() {
    const item = v.cartItem();
    if (!item) return;
    setError("");
    if (addItem(item)) {
      trackEvent("cart_add", {
        productSlug: product.slug,
        productName: product.name,
        variantId: item.variantId,
        priceCents: Math.round(item.price * 100),
      });
      setAdded([item.sizeName, item.wickTypeName, item.scentName].filter(Boolean).join(" · "));
    } else {
      setError("You already have all we have of this one in your cart.");
    }
  }

  const summary = (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
        {image && <Image src={image} alt="" fill sizes="56px" className="object-cover" />}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--home-ink)]">{product.name}</p>
        <p className="text-sm tabular-nums text-[var(--home-muted)]">{money(v.price)}</p>
      </div>
    </div>
  );

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
        <div role="status" className="rounded-2xl bg-white p-4">
          {summary}
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--home-ink)]">
            <Check className="h-4 w-4 text-[#4d6a3a]" aria-hidden />
            {added}
          </p>
        </div>
      </ShopDialog>
    );
  }

  return (
    <ShopDialog
      title="Choose your candle"
      subtitle={product.name}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <StockLine v={v} />
            <p className="text-lg font-semibold tabular-nums text-[var(--home-ink)]">{money(v.price)}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-[#9b3b2a]">
              {error}
            </p>
          )}
          <button type="button" className={`${btnPrimary} w-full`} onClick={add} disabled={!v.canBuy || v.remaining <= 0}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {v.canBuy && v.remaining <= 0 ? "All in your cart" : "Add to cart"}
          </button>
        </div>
      }
    >
      <VariantOptions v={v} compact />
    </ShopDialog>
  );
}
