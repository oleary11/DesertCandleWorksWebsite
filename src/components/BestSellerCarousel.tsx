"use client";

import { useEffect, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Product } from "@/lib/productsStore";
type Props = { products: Product[]; title?: string };

export default function BestSellerCarousel({ products, title = "Best sellers" }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateButtons();
    const onScroll = () => updateButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    const r = new ResizeObserver(updateButtons);
    r.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      r.disconnect();
    };
  }, []);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.floor(el.clientWidth * 0.9);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-6xl px-6 mt-20">
      <h2 className="text-xl font-semibold mb-6">{title}</h2>

      {/* Relative container for arrows */}
      <div className="relative overflow-visible">
        {/* LEFT ARROW */}
        <button
          onClick={() => scrollByAmount("left")}
          disabled={!canScrollLeft}
          className={`
            absolute top-1/2 -translate-y-1/2 z-10
            -left-10 md:-left-14 lg:-left-16   /* ← push outside */
            p-3 transition
            rounded-full bg-white/80 shadow-[0_4px_16px_rgba(20,16,12,.12)]
            text-[color-mix(in_oklab,var(--color-ink)_70%,white)]
            hover:text-[var(--color-ink)]
            hover:bg-white
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-8 h-8 md:w-9 md:h-9" />
        </button>

        {/* RIGHT ARROW */}
        <button
          onClick={() => scrollByAmount("right")}
          disabled={!canScrollRight}
          className={`
            absolute top-1/2 -translate-y-1/2 z-10
            -right-10 md:-right-14 lg:-right-16  /* ← push outside */
            p-3 transition
            rounded-full bg-white/80 shadow-[0_4px_16px_rgba(20,16,12,.12)]
            text-[color-mix(in_oklab,var(--color-ink)_70%,white)]
            hover:text-[var(--color-ink)]
            hover:bg-white
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-8 h-8 md:w-9 md:h-9" />
        </button>

        {/* SCROLLER */}
        <div
          ref={scrollerRef}
          className="
            flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory
            px-1 sm:px-2
            [-ms-overflow-style:none] [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          {products.map((p) => (
            <div key={p.slug} className="snap-start shrink-0 w-[280px] sm:w-[320px]">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}