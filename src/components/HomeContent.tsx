"use client";

import Image from "next/image";
import BestSellerCarousel from "@/components/BestSellerCarousel";
import MailingListSignup from "@/components/MailingListSignup";
import Link from "next/link";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import localFont from "next/font/local";
import type { Product } from "@/lib/products";
import { useEffect, useState } from "react";

const megastina = localFont({
  src: [{ path: "../../public/fonts/Megastina.ttf", weight: "400", style: "normal" }],
  variable: "--font-megastina",
  display: "swap",
});

interface HomeContentProps {
  bestsellers: (Product & { _computedStock?: number })[];
}

type InstagramPost = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

export default function HomeContent({ bestsellers }: HomeContentProps) {
  // Scroll animations for different sections
  const bestSellersSection = useScrollAnimation({ threshold: 0.2 });
  const ourSmellsSection = useScrollAnimation({ threshold: 0.2 });
  const signatureCard = useScrollAnimation({ threshold: 0.3 });
  const limitedCard = useScrollAnimation({ threshold: 0.3 });
  const seasonalCard = useScrollAnimation({ threshold: 0.3 });
  const mailingListSection = useScrollAnimation({ threshold: 0.3 });
  const instagramSection = useScrollAnimation({ threshold: 0.3 });

  // Instagram posts state
  const [instagramPosts, setInstagramPosts] = useState<InstagramPost[]>([]);
  const [instagramLoading, setInstagramLoading] = useState(true);

  useEffect(() => {
    async function loadInstagramPosts() {
      try {
        const res = await fetch("/api/instagram");
        if (res.ok) {
          const data = await res.json();
          setInstagramPosts(data.posts || []);
        }
      } catch (error) {
        console.error("Failed to load Instagram posts:", error);
      } finally {
        setInstagramLoading(false);
      }
    }
    loadInstagramPosts();
  }, []);

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
            100% natural coconut apricot wax candles in upcycled liquor bottles. Clean burning, smokeless, and eco-friendly. Desert-inspired scents made with premium natural ingredients.
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
        <div className="text-center mb-12">
          <h2
            className={`${megastina.className} script-title script-hero mb-8 relative inline-block`}
            style={{ color: "var(--color-ink)" }}
          >
            <span className="relative">
              Why Desert Candle Works?
              <span className="inline-block w-0.5 h-[1em] bg-black ml-2 animate-[caretBlink_1s_step-end_infinite] rotate-12 origin-bottom"></span>
              <span className="absolute -bottom-2 left-0 h-0.5 w-0 bg-[var(--color-accent)] animate-[expandWidth_1s_ease-out_0.3s_forwards]"></span>
            </span>
          </h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* All-Natural Ingredients */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] mb-4">
              <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--color-ink)]">100% Natural Coconut Apricot Wax</h3>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              Made from a premium blend of renewable coconut and apricot wax—no paraffin, no petroleum. Clean burning with zero toxic fumes. Safe for you, your family, and your pets.
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
              Premium coconut apricot wax burns cleaner and longer than traditional candles. No black soot, no smoke, no harsh chemicals—just pure, natural fragrance.
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
          <div className="text-center mb-10 px-6">
            <h2
              className={`${megastina.className} script-title script-hero mb-8 relative inline-block`}
              style={{ color: "var(--color-ink)" }}
            >
              <span className="relative">
                Join Our Mailing List
                <span className="inline-block w-0.5 h-[1em] bg-black ml-2 animate-[caretBlink_1s_step-end_infinite] rotate-12 origin-bottom"></span>
                <span className="absolute -bottom-2 left-0 h-0.5 w-0 bg-[var(--color-accent)] animate-[expandWidth_1s_ease-out_0.3s_forwards]"></span>
              </span>
            </h2>
          </div>
          <MailingListSignup />
        </div>
      </div>

      {/* INSTAGRAM SECTION */}
      <section
        ref={instagramSection.ref as React.RefObject<HTMLElement>}
        className={`mx-auto max-w-7xl px-6 py-16 transition-all duration-1000 ${
          instagramSection.isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10"
        }`}
      >
        <div className="text-center mb-10">
          <h2
            className={`${megastina.className} script-title script-hero mb-8 relative inline-block`}
            style={{ color: "var(--color-ink)" }}
          >
            <span className="relative">
              Follow Our Journey
              <span className="inline-block w-0.5 h-[1em] bg-black ml-2 animate-[caretBlink_1s_step-end_infinite] rotate-12 origin-bottom"></span>
              <span className="absolute -bottom-2 left-0 h-0.5 w-0 bg-[var(--color-accent)] animate-[expandWidth_1s_ease-out_0.3s_forwards]"></span>
            </span>
          </h2>
          <p className="text-base text-[var(--color-muted)] max-w-2xl mx-auto mb-6">
            See behind the scenes, new releases, and candle inspiration on Instagram
          </p>
          <a
            href="https://instagram.com/desertcandleworks"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)] hover:text-[var(--color-ink)] transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            @desertcandleworks
          </a>
        </div>

        {/* Instagram Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {instagramLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-2xl bg-neutral-200 animate-pulse"
              />
            ))
          ) : instagramPosts.length > 0 ? (
            // Show actual Instagram posts
            instagramPosts.map((post) => {
              const isVideo = post.media_type === "VIDEO";
              const imageUrl = isVideo ? (post.thumbnail_url || post.media_url) : post.media_url;
              const captionPreview = post.caption ? post.caption.substring(0, 120) + (post.caption.length > 120 ? "..." : "") : "";

              return (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-neutral-100 hover:shadow-xl transition-all duration-300"
                >
                  <img
                    src={imageUrl}
                    alt={post.caption || "Instagram post"}
                    className="w-full h-full object-cover"
                  />

                  {/* Caption overlay on hover */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-6">
                    {captionPreview ? (
                      <p className="text-white text-base text-center leading-relaxed">
                        {captionPreview}
                      </p>
                    ) : (
                      <p className="text-white text-base text-center">View on Instagram</p>
                    )}
                  </div>
                </a>
              );
            })
          ) : (
            // Fallback placeholder when no posts available
            Array.from({ length: 4 }).map((_, i) => (
              <a
                key={i}
                href="https://instagram.com/desertcandleworks"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-2xl bg-neutral-100 hover:shadow-xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-12 h-12 text-neutral-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
              </a>
            ))
          )}
        </div>

        {/* View More Button */}
        <div className="mt-10 text-center">
          <a
            href="https://instagram.com/desertcandleworks"
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3 text-base font-semibold
              border-2 border-[var(--color-accent)] text-[var(--color-accent)]
              hover:bg-[var(--color-accent)] hover:!text-white
              transition-all duration-200
              hover:scale-105 hover:shadow-lg
            "
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            View More on Instagram
          </a>
        </div>
      </section>
    </>
  );
}
