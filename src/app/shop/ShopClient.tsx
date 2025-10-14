"use client";

import { useState, useMemo } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";
import { getTotalStock } from "@/lib/productsStore";

type ShopClientProps = {
  products: Product[];
};

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type FilterOption = "all" | "in-stock" | "low-stock" | "out-of-stock";

export default function ShopClient({ products }: ShopClientProps) {
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Apply filter
    if (filterBy === "in-stock") {
      filtered = filtered.filter((p) => getTotalStock(p) > 3);
    } else if (filterBy === "low-stock") {
      filtered = filtered.filter((p) => {
        const stock = getTotalStock(p);
        return stock > 0 && stock <= 3;
      });
    } else if (filterBy === "out-of-stock") {
      filtered = filtered.filter((p) => getTotalStock(p) === 0);
    }

    // Apply sort
    filtered.sort((a, b) => {
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
          return 0;
      }
    });

    return filtered;
  }, [products, sortBy, filterBy]);

  const productCount = products.length;
  const inStockCount = products.filter((p) => getTotalStock(p) > 0).length;
  const displayCount = filteredAndSortedProducts.length;

  return (
    <>
      {/* Header with counts */}
      <div className="full-bleed relative isolate py-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-[2px]" />
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h1>Shop Scottsdale Candles</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            Hand-poured soy candles made locally in Arizona. Upcycled bottles, wood wicks, and desert-inspired scents.
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Showing {displayCount} of {productCount} {productCount === 1 ? "candle" : "candles"} ({inStockCount} in stock)
          </p>
        </div>
      </div>

      {/* Filters and Sort Controls */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterBy("all")}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                filterBy === "all"
                  ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                  : "bg-white border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterBy("in-stock")}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                filterBy === "in-stock"
                  ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                  : "bg-white border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setFilterBy("low-stock")}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                filterBy === "low-stock"
                  ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                  : "bg-white border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setFilterBy("out-of-stock")}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                filterBy === "out-of-stock"
                  ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                  : "bg-white border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              Out of Stock
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-[var(--color-muted)] whitespace-nowrap">
              Sort by:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)] focus:ring-offset-1"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price (Low-High)</option>
              <option value="price-desc">Price (High-Low)</option>
            </select>
          </div>
        </div>

        {/* Product grid */}
        <div className="mt-8 grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredAndSortedProducts.map((p) => (
            <ProductCard key={p.slug} product={p} compact />
          ))}
        </div>

        {/* Empty state */}
        {filteredAndSortedProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--color-muted)]">No candles match your filters.</p>
            <button
              onClick={() => {
                setFilterBy("all");
                setSortBy("name-asc");
              }}
              className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}
