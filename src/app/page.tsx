// app/page.tsx (or wherever your Home component lives)
import Image from "next/image";
import BestSellerCarousel from "@/components/BestSellerCarousel";
import MailingListSignup from "@/components/MailingListSignup";
import Link from "next/link";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import localFont from "next/font/local";
import TypingLoop from "@/components/TypingLoop";

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
            Hand-Poured Candles in Scottsdale, Arizona
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-[var(--color-muted)]">
            Locally crafted soy candles in upcycled liquor bottles. Wood wicks, clean burns, and desert-inspired scents made in Phoenix.
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
        
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-2 text-center">
      <h2 className={`${megastina.className} script-title`}>
        <TypingLoop
          texts="Best Sellers"
          className="script-hero"
          // optional per-heading tuning (can omit since defaults updated)
          typingMs={120}
          deletingMs={70}
          holdFullMs={1800}
          holdEmptyMs={900}
        />
      </h2>
    </section>
    
      {/* BEST SELLERS — still pulled up tight */}
      <div className="-mt-2">
        <BestSellerCarousel products={bestsellers} />
      </div>

      {/* Divider line between Best Sellers and Our Smells */}
      <div className="mx-auto max-w-4xl px-6 my-10">
        <div className="h-px bg-[color-mix(in_oklab,var(--color-ink)_15%,transparent)]" />
      </div>
      
      {/* OUR SMELLS — big, cursive, typing effect (FIRST under banner) */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-0 text-center">
        <h2 className={`${megastina.className} script-title`} style={{ color: "var(--color-ink)" }}>
          <TypingLoop texts="Our Smells" className="script-hero" />
        </h2>
      </section>

      {/* MINI BLURB UNDER HERO */}
      <section className="mx-auto max-w-4xl px-6 pt-4 pb-8 text-center">
        <p className="text-sm sm:text-base leading-relaxed text-[var(--color-muted)]">
          Our lineup rotates through{" "}
          <span className="font-medium text-[var(--color-ink)]">Signature</span> blends,
          small-batch{" "}
          <span className="font-medium text-[var(--color-ink)]">Limited</span> pours on select bottles,
          and limited-time{" "}
          <span className="font-medium text-[var(--color-ink)]">Seasonal</span> scents available across all bottles.
        </p>
      </section>

     {/* SCENT PROGRAM OVERVIEW — all blue mist cards */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-0">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Signature */}
          <div className="card rounded-2xl p-6 sm:p-7 card--mist">
            <div className="flex items-center gap-2">
              <span className="badge badge--mist">Signature</span>
              <span className="text-xs text-[var(--color-muted)]/70">Rotating Core</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">Always-Return Favorites</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Our core, desert-inspired blends cycle in and out through the year.
            </p>
            <ul className="mt-4 text-sm leading-7 text-[var(--color-ink)]/90">
              <li><span className="font-medium">Wood and Bloom</span> — Lavender &amp; Sandalwood</li>
              <li><span className="font-medium">Cabin Spa</span> — Amber, Lavender, &amp; Sandalwood</li>
              <li><span className="font-medium">Boot Leather</span> — Bonfire &amp; Leather</li>
              <li><span className="font-medium">Minted Lavender</span> — Eucalyptus &amp; Lavender</li>
              <li><span className="font-medium">Smoked Amber</span> — Amber &amp; Bonfire</li>
            </ul>
          </div>

          {/* Limited */}
          <div className="card rounded-2xl p-6 sm:p-7 card--mist">
            <div className="flex items-center gap-2">
              <span className="badge badge--mist">Limited</span>
              <span className="text-xs text-[var(--color-muted)]/70">Small Batch</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">New Combos, Limited Runs</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              We test fresh pairings and tweak ratios. These pours are{" "}
              <span className="font-medium">small-batch</span> and only appear on{" "}
              <span className="font-medium">select candles</span>. When they&rsquo;re gone, they&rsquo;re gone.
            </p>
            <p className="mt-3 text-xs text-[var(--color-muted)]/80">
              Check product pages for notes on current batches.
            </p>
          </div>

          {/* Seasonal */}
          <div className="card rounded-2xl p-6 sm:p-7 card--mist">
            <div className="flex items-center gap-2">
              <span className="badge badge--mist">Seasonal</span>
              <span className="text-xs text-[var(--color-muted)]/70">Limited Time</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">Made for the Moment</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Timed to the season and available{" "}
              <span className="font-medium">across all bottle styles</span> during the run.
            </p>
            <p className="mt-3 text-xs text-[var(--color-muted)]/80">
              Look for drop dates and restocks on socials and our newsletter.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 my-10">
        <div className="h-px bg-[color-mix(in_oklab,var(--color-ink)_15%,transparent)]" />
      </div>

      <div className="pb-6">
        <MailingListSignup />
      </div>
    </>
  );
}