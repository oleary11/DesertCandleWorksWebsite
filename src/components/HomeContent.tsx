"use client";

import Image from "next/image";
import BestSellerCarousel from "@/components/BestSellerCarousel";
import MailingListSignup from "@/components/MailingListSignup";
import Link from "next/link";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import localFont from "next/font/local";
import type { Product } from "@/lib/products";

const megastina = localFont({
  src: [{ path: "../../public/fonts/Megastina.ttf", weight: "400", style: "normal" }],
  variable: "--font-megastina",
  display: "swap",
});

interface HomeContentProps {
  bestsellers: (Product & { _computedStock?: number })[];
}

export default function HomeContent({ bestsellers }: HomeContentProps) {
  // Scroll animations for different sections
  const bestSellersSection = useScrollAnimation({ threshold: 0.2 });
  const ourSmellsSection = useScrollAnimation({ threshold: 0.2 });
  const signatureCard = useScrollAnimation({ threshold: 0.3 });
  const limitedCard = useScrollAnimation({ threshold: 0.3 });
  const seasonalCard = useScrollAnimation({ threshold: 0.3 });
  const mailingListSection = useScrollAnimation({ threshold: 0.3 });

  return (
    <>
      {/* HERO */}
      <section
        className="
          relative isolate overflow-hidden
          w-screen left-1/2 -translate-x-1/2
          h-[420px] sm:h-[480px] lg:h-[520px]
          flex items-center justify-center text-center
          shadow-[inset_0_0_0_1px_color-mix(in_oklab,_var(--color-ink)_6%,_transparent)]
        "
      >
        <Image
          src="/images/desert-bg.jpg"
          alt="Desert landscape"
          fill
          className="object-cover object-center pointer-events-none"
          priority
          sizes="100vw"
          quality={90}
        />
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
        <div className="relative z-10 px-6">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            All-Natural Candles in Scottsdale, Arizona
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-[var(--color-muted)]">
            100% natural soy coconut wax candles in upcycled liquor bottles. Clean burning, smokeless, and eco-friendly. Desert-inspired scents made with premium natural ingredients.
          </p>
          <div className="mt-8">
            <Link
              href="/shop"
              className="
                btn-cta inline-flex items-center justify-center rounded-2xl px-10 py-4 text-base sm:text-lg font-semibold
                border-0 text-white
                [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
                shadow-[0_2px_0_rgba(255,255,255,.5)_inset,0_12px_40px_rgba(212,165,116,.25),0_8px_20px_rgba(20,16,12,.12)]
                hover:shadow-[0_2px_0_rgba(255,255,255,.6)_inset,0_16px_50px_rgba(212,165,116,.35),0_12px_30px_rgba(20,16,12,.16)]
                hover:-translate-y-1 transition-all duration-200
                hover:scale-105
              "
            >
              Shop Candles
            </Link>
          </div>
        </div>
      </section>

      {/* ECO-FRIENDLY & ALL-NATURAL BENEFITS */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* All-Natural Ingredients */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] mb-4">
              <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--color-ink)]">100% Natural Soy Coconut Wax</h3>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              Made from a premium blend of renewable soy and coconut wax—no paraffin, no petroleum. Clean burning with zero toxic fumes. Safe for you, your family, and your pets.
            </p>
          </div>

          {/* Clean & Smokeless */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] mb-4">
              <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--color-ink)]">Clean & Smokeless Burn</h3>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              Premium soy coconut wax burns cleaner and longer than traditional candles. No black soot, no smoke, no harsh chemicals—just pure, natural fragrance.
            </p>
          </div>

          {/* Eco-Friendly Upcycling */}
          <div className="text-center sm:col-span-2 lg:col-span-1">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] mb-4">
              <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--color-ink)]">Eco-Friendly Upcycled Bottles</h3>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              We rescue beautiful bottles from Scottsdale bars and restaurants, giving them new life instead of the landfill. Each candle saves glass waste and reduces environmental impact.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-4xl px-6 mb-6">
        <div className="h-px bg-[color-mix(in_oklab,var(--color-ink)_15%,transparent)]" />
      </div>

      {/* BEST SELLERS */}
      <section
        ref={bestSellersSection.ref as React.RefObject<HTMLElement>}
        className={`mx-auto max-w-7xl px-6 pt-6 pb-8 transition-all duration-1000 ${
          bestSellersSection.isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10"
        }`}
      >
        <div className="text-center mb-8">
          <h2
            className={`${megastina.className} script-title script-hero relative inline-block`}
          >
            <span className="relative">
              Best Sellers
              <span className="inline-block w-0.5 h-[1em] bg-black ml-2 animate-[caretBlink_1s_step-end_infinite] rotate-12 origin-bottom"></span>
              <span className="absolute -bottom-2 left-0 h-0.5 w-0 bg-[var(--color-accent)] animate-[expandWidth_1s_ease-out_0.3s_forwards]"></span>
            </span>
          </h2>
        </div>
      </section>

      {/* BEST SELLERS — still pulled up tight */}
      <div className="-mt-2">
        <BestSellerCarousel products={bestsellers} />
      </div>

      {/* Divider line between Best Sellers and Our Smells */}
      <div className="mx-auto max-w-4xl px-6 my-4">
        <div className="h-px bg-[color-mix(in_oklab,var(--color-ink)_15%,transparent)]" />
      </div>

      {/* OUR SMELLS SECTION */}
      <section
        ref={ourSmellsSection.ref as React.RefObject<HTMLElement>}
        className={`mx-auto max-w-7xl px-6 pt-6 pb-16 transition-all duration-1000 ${
          ourSmellsSection.isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10"
        }`}
      >
        {/* Header */}
        <div className="text-center mb-12">
          <h2
            className={`${megastina.className} script-title script-hero mb-10 relative inline-block`}
            style={{ color: "var(--color-ink)" }}
          >
            <span className="relative">
              Our Smells
              <span className="inline-block w-0.5 h-[1em] bg-black ml-2 animate-[caretBlink_1s_step-end_infinite] rotate-12 origin-bottom"></span>
              <span className="absolute -bottom-2 left-0 h-0.5 w-0 bg-[var(--color-accent)] animate-[expandWidth_1s_ease-out_0.3s_forwards]"></span>
            </span>
          </h2>
          <p className="text-base sm:text-lg leading-relaxed text-[var(--color-muted)] max-w-3xl mx-auto">
            Our lineup features core{" "}
            <span className="font-semibold text-[var(--color-ink)]">Signature</span> blends,
            small-batch{" "}
            <span className="font-semibold text-[var(--color-ink)]">Limited</span> pours on select
            bottles, and limited-time{" "}
            <span className="font-semibold text-[var(--color-ink)]">Seasonal</span> scents on
            select bottles.
          </p>
        </div>

        {/* Scent Cards Grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Signature Card */}
          <div
            ref={signatureCard.ref as React.RefObject<HTMLDivElement>}
            className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 shadow-lg hover:shadow-xl transition-all duration-700 border border-amber-100/50 ${
              signatureCard.isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4 shadow-lg">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>

              {/* Badge and label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  Signature
                </span>
                <span className="text-xs text-[var(--color-muted)]">Our Favorites</span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-3 text-[var(--color-ink)]">
                Always-Return Favorites
              </h3>

              {/* Description */}
              <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-4">
                Our core, desert-inspired blends that are always in rotation.
              </p>

              {/* Scent list */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold text-[var(--color-ink)]">Wood and Bloom:</span>{" "}
                    <span className="text-[var(--color-muted)]">A calming blend of soft lavender and warm sandalwood for a relaxing aroma.</span>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold text-[var(--color-ink)]">Cabin Spa:</span>{" "}
                    <span className="text-[var(--color-muted)]">Small notes of sandalwood, gentle lavender, and warm amber create a spa retreat in candle form.</span>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold text-[var(--color-ink)]">Boot Leather:</span>{" "}
                    <span className="text-[var(--color-muted)]">Ever smell the inside of a boot store? A bold blend of rich leather and warm bonfire embers.</span>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold text-[var(--color-ink)]">Smoked Amber:</span>{" "}
                    <span className="text-[var(--color-muted)]">Smooth amber wrapped in smoky bonfire embers - rich, refined, and beautifully balanced.</span>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold text-[var(--color-ink)]">Minted Lavender:</span>{" "}
                    <span className="text-[var(--color-muted)]">Crisp eucalyptus and soft lavender create a clean, spa-fresh scent.</span>
                  </p>
                </div>
              </div>

              {/* Link */}
              <div className="mt-6 pt-4 border-t border-amber-100">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 transition-colors group/link"
                >
                  <span>View All Signature Scents</span>
                  <svg
                    className="w-4 h-4 group-hover/link:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Limited Card */}
          <div
            ref={limitedCard.ref as React.RefObject<HTMLDivElement>}
            className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-50 via-white to-pink-50 p-8 shadow-lg hover:shadow-xl transition-all duration-700 delay-100 border border-purple-100/50 ${
              limitedCard.isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>

              {/* Badge and label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                  Limited
                </span>
                <span className="text-xs text-[var(--color-muted)]">Small-Batch Experiments</span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-3 text-[var(--color-ink)]">
                Exclusive Experiments
              </h3>

              {/* Description */}
              <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-4">
                We test fresh pairings and tweak ratios. These pours are{" "}
                <span className="font-semibold text-[var(--color-ink)]">small-batch</span> and only
                appear on{" "}
                <span className="font-semibold text-[var(--color-ink)]">select candles</span>. When
                they&apos;re gone, they&apos;re gone.
              </p>

              {/* Additional info */}
              <div className="mt-6 pt-4 border-t border-purple-100">
                <p className="text-xs text-[var(--color-muted)] italic">
                  Look for the Limited badge in our shop. Once we sell out, the scent may never come
                  back.
                </p>
              </div>
            </div>
          </div>

          {/* Seasonal Card */}
          <div
            ref={seasonalCard.ref as React.RefObject<HTMLDivElement>}
            className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8 shadow-lg hover:shadow-xl transition-all duration-700 delay-200 border border-emerald-100/50 ${
              seasonalCard.isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>

              {/* Badge and label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Seasonal
                </span>
                <span className="text-xs text-[var(--color-muted)]">Limited Time</span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-3 text-[var(--color-ink)]">Made for the Moment</h3>

              {/* Description */}
              <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-4">
                Timed to the season and available{" "}
                <span className="font-semibold text-[var(--color-ink)]">on select bottles</span>{" "}
                during the run.
              </p>

              {/* Additional info */}
              <div className="mt-6 pt-4 border-t border-emerald-100">
                <p className="text-xs text-[var(--color-muted)] italic">
                  Look for drop dates and restocks on socials and our newsletter.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Button */}
        <div className="mt-12 text-center">
          <Link
            href="/shop"
            className="
              inline-flex items-center justify-center rounded-2xl px-10 py-4 text-base sm:text-lg font-semibold
              border-0 !text-white
              [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
              shadow-[0_2px_0_rgba(255,255,255,.5)_inset,0_12px_40px_rgba(212,165,116,.25),0_8px_20px_rgba(20,16,12,.12)]
              hover:shadow-[0_2px_0_rgba(255,255,255,.6)_inset,0_16px_50px_rgba(212,165,116,.35),0_12px_30px_rgba(20,16,12,.16)]
              hover:-translate-y-1 transition-all duration-200
              hover:scale-105
            "
          >
            Shop Our Scents
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 my-3">
        <div className="h-px bg-[color-mix(in_oklab,var(--color-ink)_15%,transparent)]" />
      </div>

      <div
        className={`pb-6 transition-all duration-1000 ${
          mailingListSection.isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10"
        }`}
      >
        <div ref={mailingListSection.ref as React.RefObject<HTMLDivElement>}>
          <MailingListSignup />
        </div>
      </div>
    </>
  );
}
