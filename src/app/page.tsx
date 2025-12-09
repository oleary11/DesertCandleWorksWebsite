// app/page.tsx (or wherever your Home component lives)
import Image from "next/image";
import BestSellerCarousel from "@/components/BestSellerCarousel";
import MailingListSignup from "@/components/MailingListSignup";
import Link from "next/link";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import localFont from "next/font/local";

const megastina = localFont({
  src: [{ path: "../../public/fonts/Megastina.ttf", weight: "400", style: "normal" }],
  variable: "--font-megastina",
  display: "swap",
});

export const revalidate = 3600;

export default async function Home() {
  const all = await listResolvedProducts();
  const bestSellerProducts = all.filter((p) => !!p.bestSeller);

  // Add computed stock to bestsellers
  const bestsellersWithStock = await Promise.all(
    bestSellerProducts.map(async (p) => {
      const computedStock = await getTotalStockForProduct(p);
      return { ...p, _computedStock: computedStock };
    })
  );

  // Sort by stock (in-stock first)
  const bestsellers = bestsellersWithStock.sort((a, b) => {
    const aInStock = a._computedStock > 0 ? 1 : 0;
    const bInStock = b._computedStock > 0 ? 1 : 0;
    return bInStock - aInStock;
  });

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
          alt="Desert dunes background"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
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

      <section className="mx-auto max-w-6xl px-6 pt-6 pb-8 text-center">
      <h2 className={`${megastina.className} script-title script-hero animate-[fadeInUp_0.8s_ease-out] relative inline-block`}>
        <span className="relative">
          Best Sellers
          <span className="inline-block w-0.5 h-[1em] bg-black ml-2 animate-[caretBlink_1s_step-end_infinite] rotate-12 origin-bottom"></span>
          <span className="absolute -bottom-2 left-0 h-0.5 w-0 bg-[var(--color-accent)] animate-[expandWidth_1s_ease-out_0.3s_forwards]"></span>
        </span>
      </h2>
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
      <section className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className={`${megastina.className} script-title script-hero mb-10 animate-[fadeInUp_0.8s_ease-out] relative inline-block`} style={{ color: "var(--color-ink)" }}>
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
            <span className="font-semibold text-[var(--color-ink)]">Limited</span> pours on select bottles,
            and limited-time{" "}
            <span className="font-semibold text-[var(--color-ink)]">Seasonal</span> scents on select bottles.
          </p>
        </div>

        {/* Scent Cards Grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Signature Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-amber-100/50">
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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
              <h3 className="text-xl font-bold mb-3 text-[var(--color-ink)]">Always-Return Favorites</h3>

              {/* Description */}
              <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-4">
                Our core, desert-inspired blends that are always in rotation.
              </p>

              {/* Scent list */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="font-semibold text-[var(--color-ink)]">Wood and Bloom</span> <span className="text-[var(--color-muted)]">— Lavender & Sandalwood</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="font-semibold text-[var(--color-ink)]">Cabin Spa</span> <span className="text-[var(--color-muted)]">— Amber, Lavender, & Sandalwood</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="font-semibold text-[var(--color-ink)]">Boot Leather</span> <span className="text-[var(--color-muted)]">— Bonfire & Leather</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="font-semibold text-[var(--color-ink)]">Minted Lavender</span> <span className="text-[var(--color-muted)]">— Eucalyptus & Lavender</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="font-semibold text-[var(--color-ink)]">Smoked Amber</span> <span className="text-[var(--color-muted)]">— Amber & Bonfire</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Limited Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100/50">
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200/20 to-indigo-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 mb-4 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>

              {/* Badge and label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                  Limited
                </span>
                <span className="text-xs text-[var(--color-muted)]">Small Batch</span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-3 text-[var(--color-ink)]">New Combos, Limited Runs</h3>

              {/* Description */}
              <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-4">
                We test fresh pairings and tweak ratios. These pours are{" "}
                <span className="font-semibold text-[var(--color-ink)]">small-batch</span> and only appear on{" "}
                <span className="font-semibold text-[var(--color-ink)]">select candles</span>. When they&apos;re gone, they&apos;re gone.
              </p>

              {/* Additional info */}
              <div className="mt-6 pt-4 border-t border-purple-100">
                <p className="text-xs text-[var(--color-muted)] italic">
                  Check product pages for notes on current batches.
                </p>
              </div>
            </div>
          </div>

          {/* Seasonal Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-emerald-100/50">
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                <span className="font-semibold text-[var(--color-ink)]">on select bottles</span> during the run.
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

      <div className="pb-6">
        <MailingListSignup />
      </div>
    </>
  );
}