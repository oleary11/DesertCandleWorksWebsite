"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";
import { generateVariants } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { Truck, Search, CheckCircle, XCircle, SlidersHorizontal, X } from "lucide-react";
import s from "@/components/home/home.module.css";
import { serif, script } from "@/lib/storefrontFonts";
import ShopDialog from "@/components/shop/ShopDialog";
import { btnPrimary, btnQuiet, chipClass, fieldClass, labelClass } from "@/components/shop/styles";

type ProductWithStock = Product & { _computedStock: number };

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type FilterOption = "all" | "in-stock" | "low-stock" | "out-of-stock";

type AlcoholType = { id: string; name: string; sortOrder?: number };

type YoungDumbClientProps = {
  products: ProductWithStock[];
  globalScents: GlobalScent[];
  alcoholTypes: AlcoholType[];
};

export default function YoungDumbClient({ products, globalScents, alcoholTypes }: YoungDumbClientProps) {
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clearCart);

  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [filterBy, setFilterBy] = useState<FilterOption>("in-stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [statusType, setStatusType] = useState<"success" | "cancelled" | null>(null);

  // Price range from products
  const priceRange = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 100 };
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  const [priceMin, setPriceMin] = useState(priceRange.min);
  const [priceMax, setPriceMax] = useState(priceRange.max);

  // Checkout status & banner
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success" || status === "cancelled") {
      setStatusType(status);
      setShowStatusBanner(true);

      if (status === "success") {
        clearCart();
      }

      const timer = setTimeout(() => {
        setShowStatusBanner(false);
      }, 10000);

      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url.toString());

      return () => clearTimeout(timer);
    }
  }, [searchParams, clearCart]);

  // Restore scroll when coming back from product page
  useEffect(() => {
    const shouldRestore = sessionStorage.getItem("useBackButton");
    const savedPosition = sessionStorage.getItem("shopScrollPosition");

    if (shouldRestore === "true" && savedPosition) {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: parseInt(savedPosition, 10),
          behavior: "instant" as ScrollBehavior,
        });
      });

      sessionStorage.removeItem("useBackButton");
      sessionStorage.removeItem("fromProductPage");
    }
  }, []);

  // Filter/sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const descMatch = p.seoDescription?.toLowerCase().includes(query);
        return nameMatch || descMatch;
      });
    }

    // Price range
    filtered = filtered.filter((p) => p.price >= priceMin && p.price <= priceMax);

    // Stock filter
    if (filterBy === "in-stock") {
      filtered = filtered.filter((p) => p._computedStock > 0);
    } else if (filterBy === "low-stock") {
      filtered = filtered.filter((p) => p._computedStock > 0 && p._computedStock <= 3);
    } else if (filterBy === "out-of-stock") {
      filtered = filtered.filter((p) => p._computedStock === 0);
    }
    // "all" shows everything - no filtering needed

    // Sort: in-stock first, then user-selected sort
    filtered.sort((a, b) => {
      const aIn = a._computedStock > 0 ? 1 : 0;
      const bIn = b._computedStock > 0 ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;

      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, sortBy, filterBy, searchQuery, priceMin, priceMax]);

  // Build ordering index for Alcohol Types
  const typeOrderIndex = useMemo(() => {
    const idx = new Map<string, number>();
    alcoholTypes.forEach((t, i) => idx.set(t.name, t.sortOrder ?? i + 1));
    if (!idx.has("Other")) idx.set("Other", 9999);
    return idx;
  }, [alcoholTypes]);

  // Group filtered results by Alcohol Type in requested order
  const grouped = useMemo(() => {
    const m = new Map<string, ProductWithStock[]>();
    for (const p of filteredAndSortedProducts) {
      const key = p.alcoholType || "Other";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }

    // keep graceful name sort inside each group
    for (const [key, list] of m) {
      list.sort((a, b) => a.name.localeCompare(b.name));
      m.set(key, list);
    }

    // order sections by alcoholTypes sortOrder (fallback alpha)
    return Array.from(m.entries()).sort((a, b) => {
      const ai = typeOrderIndex.get(a[0]) ?? 9999;
      const bi = typeOrderIndex.get(b[0]) ?? 9999;
      if (ai !== bi) return ai - bi;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredAndSortedProducts, typeOrderIndex]);

  const productCount = products.length;
  const inStockCount = products.filter((p) => p._computedStock > 0).length;
  const displayCount = filteredAndSortedProducts.length;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasActiveFilters =
    sortBy !== "name-asc" || filterBy !== "in-stock" || searchQuery !== "" || priceMin !== priceRange.min || priceMax !== priceRange.max;

  function resetFilters() {
    setSortBy("name-asc");
    setFilterBy("in-stock");
    setSearchQuery("");
    setPriceMin(priceRange.min);
    setPriceMax(priceRange.max);
  }

  const filterPanel = (
    <div className="space-y-7">
      <fieldset>
        <legend className={labelClass}>Availability</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["in-stock", "In stock"],
              ["all", "Everything"],
              ["low-stock", "Almost gone"],
              ["out-of-stock", "Sold out"],
            ] as [FilterOption, string][]
          ).map(([opt, label]) => (
            <button key={opt} type="button" aria-pressed={filterBy === opt} onClick={() => setFilterBy(opt)} className={chipClass(filterBy === opt)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={`${labelClass} flex w-full items-baseline justify-between`}>
          Price
          <span className="text-sm font-normal tabular-nums text-[var(--home-muted)]">
            ${priceMin} – ${priceMax}
          </span>
        </legend>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Minimum</span>
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={priceMin}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val <= priceMax) setPriceMin(val);
              }}
              className="w-full cursor-pointer accent-[var(--home-clay)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Maximum</span>
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={priceMax}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= priceMin) setPriceMax(val);
              }}
              className="w-full cursor-pointer accent-[var(--home-clay)]"
            />
          </label>
        </div>
      </fieldset>

      {hasActiveFilters && (
        <button type="button" onClick={resetFilters} className={`${btnQuiet} w-full`}>
          Reset filters
        </button>
      )}
    </div>
  );

  return (
    <div className={`${s.page} s-ui`}>
      {showStatusBanner && statusType && (
        <div role="status" className={`px-6 py-4 ${statusType === "success" ? "bg-[var(--home-sage)]" : "bg-[var(--home-peach)]"}`}>
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {statusType === "success" ? (
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#4d6a3a]" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--home-clay)]" aria-hidden />
              )}
              <div>
                <p className="font-semibold text-[var(--home-ink)]">
                  {statusType === "success" ? "Thank you, your order is confirmed" : "Checkout cancelled"}
                </p>
                <p className="text-sm text-[var(--home-muted)]">
                  {statusType === "success" ? "A confirmation email is on its way." : "Nothing was charged. Your cart is still here when you're ready."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowStatusBanner(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] hover:bg-white/60 hover:text-[var(--home-ink)]"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Header band: the playful corner of the shop */}
      <header className="relative overflow-hidden bg-[var(--home-blush)] px-6 pb-12 pt-14 sm:pt-20">
        <div aria-hidden className={`${s.blob} absolute -right-16 -top-20 h-72 w-72 bg-[var(--home-peach)] opacity-80 sm:h-96 sm:w-96`} />
        <div aria-hidden className={`${s.blobAlt} absolute -bottom-24 -left-10 h-64 w-64 bg-[var(--home-sage)] opacity-70`} />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--home-clay)]">A collection</p>
          <h1 className={`${serif.className} mt-3 text-5xl leading-none text-[var(--home-ink)] sm:text-6xl`}>Young &amp; Dumb</h1>
          <p className={`${script.className} mt-2 -rotate-2 pl-1 text-[2rem] leading-[1.4] text-[var(--home-clay)] sm:text-[2.8rem]`}>yeah, we were too once…</p>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-[var(--home-ink)]/80">
            Trendy candles in bottles you know and love. Perfect for gifts, dorms, or your first apartment.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm text-[var(--home-ink)]">
            <Truck className="h-4 w-4 text-[var(--home-clay)]" aria-hidden />
            Free shipping over $100 · Free local pickup in Scottsdale
          </p>
        </div>
      </header>

      <div className={`${s.cream} px-6 pb-20 pt-8`}>
        <div className="mx-auto flex max-w-7xl gap-12">
          <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filters">
            <div className="sticky top-28">{filterPanel}</div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block flex-1">
                <span className="sr-only">Search Young &amp; Dumb</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8958a]" aria-hidden />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search this collection…"
                  autoComplete="off"
                  className={`${fieldClass} pl-10`}
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFiltersOpen(true)} className={`${btnQuiet} flex-1 lg:hidden`} aria-haspopup="dialog">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  Filters
                </button>
                <label className="block flex-1 sm:w-48 sm:flex-none">
                  <span className="sr-only">Sort</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className={`${fieldClass} min-h-11`}>
                    <option value="name-asc">Name, A–Z</option>
                    <option value="name-desc">Name, Z–A</option>
                    <option value="price-asc">Price, low to high</option>
                    <option value="price-desc">Price, high to low</option>
                  </select>
                </label>
              </div>
            </div>

            <p className="mt-4 text-sm text-[var(--home-muted)]" aria-live="polite">
              {displayCount} of {productCount} {productCount === 1 ? "candle" : "candles"} · {inStockCount} in stock
            </p>

            <div className="mt-8 space-y-14">
              {displayCount === 0 ? (
                <div className="rounded-3xl bg-white/70 px-6 py-16 text-center">
                  <p className={`${serif.className} text-2xl text-[var(--home-ink)]`}>Nothing matches those filters</p>
                  <button type="button" onClick={resetFilters} className={`${btnPrimary} mt-6`}>
                    Reset filters
                  </button>
                </div>
              ) : (
                grouped.map(([alcoholType, typeProducts]) => (
                  <section key={alcoholType} aria-labelledby={`yd-${alcoholType}`}>
                    <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-[var(--home-line)] pb-3">
                      <h2 id={`yd-${alcoholType}`} className={`${serif.className} text-2xl text-[var(--home-ink)] sm:text-[1.75rem]`}>
                        {alcoholType}
                      </h2>
                      <span className="text-sm tabular-nums text-[var(--home-muted)]">{typeProducts.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
                      {typeProducts.map((product) => (
                        <ProductCard
                          key={product.slug}
                          product={product}
                          globalScents={globalScents}
                          variants={product.variantConfig ? generateVariants(product, globalScents) : []}
                          compact
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <ShopDialog
          title="Filters"
          subtitle={`${displayCount} ${displayCount === 1 ? "candle" : "candles"} match`}
          onClose={() => setFiltersOpen(false)}
          footer={
            <button type="button" className={`${btnPrimary} w-full`} onClick={() => setFiltersOpen(false)}>
              Show {displayCount} {displayCount === 1 ? "candle" : "candles"}
            </button>
          }
        >
          {filterPanel}
        </ShopDialog>
      )}
    </div>
  );
}
