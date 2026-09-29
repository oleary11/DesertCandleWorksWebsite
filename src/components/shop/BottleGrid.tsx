"use client";

import { useMemo, useState } from "react";
import { Search, Wine } from "lucide-react";
import type { BottlePickerOption } from "@/app/shop/[slug]/HomeGoodsBottlePicker";
import type { CartItem } from "@/lib/cartStore";
import { fieldClass, money } from "./styles";

/** Cart line for a Home Goods bottle. Price and stock are re-checked server-side at checkout. */
export function bottleCartItem(productSlug: string, productName: string, bottle: BottlePickerOption): Omit<CartItem, "quantity"> {
  return {
    productSlug,
    productName: `${productName} — ${bottle.name}`,
    productImage: bottle.imageUrl,
    price: bottle.priceCents / 100,
    // Not trusted at checkout: the server re-resolves the price from the
    // product's bottleOptions using variantId (the bottle id).
    stripePriceId: "home_goods",
    variantId: bottle.bottleId,
    maxStock: bottle.stock,
    productType: "home_goods",
  };
}

/** Searchable bottle chooser, grouped by alcohol type (bottles arrive pre-sorted by type). */
export default function BottleGrid({
  bottles,
  selectedId,
  onSelect,
}: {
  bottles: BottlePickerOption[];
  selectedId?: string;
  onSelect: (bottleId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, BottlePickerOption[]>();
    for (const b of bottles) {
      if (q && !b.name.toLowerCase().includes(q)) continue;
      const key = b.alcoholType || "Other";
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    return Array.from(map.entries());
  }, [bottles, search]);

  return (
    <div>
      {bottles.length > 6 && (
        <label className="relative mb-4 block">
          <span className="sr-only">Search bottles</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8958a]" aria-hidden />
          <input
            type="search"
            className={`${fieldClass} pl-10`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bottles…"
            autoComplete="off"
          />
        </label>
      )}

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--home-muted)]">No bottles match “{search}”.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(([type, list]) => (
            <section key={type}>
              {groups.length > 1 && (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--home-muted)]">{type}</h3>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {list.map((b) => {
                  const selected = b.bottleId === selectedId;
                  return (
                    <button
                      key={b.bottleId}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(b.bottleId)}
                      className={`group rounded-2xl p-2 text-left transition-colors ${
                        selected
                          ? "bg-white ring-2 ring-[var(--home-ink)]"
                          : "bg-white/70 ring-1 ring-[var(--home-line)] hover:ring-[var(--home-ink)]"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)]`}
                    >
                      <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[var(--home-sand)]">
                        {b.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote bottle photos from any host
                          <img src={b.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                        ) : (
                          <Wine className="h-8 w-8 text-[#c9b3a2]" strokeWidth={1.5} aria-hidden />
                        )}
                      </div>
                      <p className="truncate text-sm font-medium text-[var(--home-ink)]" title={b.name}>
                        {b.name}
                      </p>
                      <p className="text-xs tabular-nums text-[var(--home-muted)]">
                        {money(b.priceCents / 100)}
                        {b.stock === 1 && <span className="text-[#9b3b2a]"> · Only 1 left</span>}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
