"use client";

import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Young_Serif } from "next/font/google";
import { useEffect, useState } from "react";
import { ArrowRight, Flame, Leaf, Recycle, Sparkles, Sun, Sprout } from "lucide-react";
import BestSellerCarousel from "@/components/BestSellerCarousel";
import MailingListSignup from "@/components/MailingListSignup";
import type { Product } from "@/lib/products";
import s from "@/components/home/home.module.css";

const script = localFont({
  src: [{ path: "../../public/fonts/Megastina.ttf", weight: "400", style: "normal" }],
  display: "swap",
});

const serif = Young_Serif({ weight: "400", subsets: ["latin"], display: "swap" });

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

const promises = [
  {
    icon: Leaf,
    title: "Natural coconut apricot wax",
    body: "No paraffin, no petroleum. Kinder for you, your family and your pets.",
  },
  {
    icon: Flame,
    title: "Clean, low-soot burn",
    body: "Burns cleaner and longer, with no black soot.",
  },
  {
    icon: Recycle,
    title: "Upcycled bottles",
    body: "Rescued from Scottsdale bars and restaurants and given a second life.",
  },
];

const signatureScents = [
  { name: "Cabin Spa", notes: "Sandalwood, gentle lavender and warm amber. A spa retreat in candle form." },
  { name: "Boot Leather", notes: "Ever smell the inside of a boot store? Rich leather and warm bonfire embers." },
  { name: "Smoked Amber", notes: "Smooth amber wrapped in smoky embers. Rich, refined and balanced." },
  { name: "Minted Lavender", notes: "Crisp eucalyptus and soft lavender for a clean, spa-fresh scent." },
  { name: "Sea Salt & Linen", notes: "Fresh linen with warm Caribbean teakwood. Clean and calming." },
];

// Shown when the Instagram feed can't load (e.g. the access token expired),
// so the section still looks like a live feed instead of empty tiles.
const instagramFallback = [
  { src: "/images/hendricks.png", alt: "A lit candle in an upcycled Hendrick's Gin bottle" },
  { src: "/images/home/workshop.jpg", alt: "Cutting a liquor bottle by hand in the workshop" },
  { src: "/images/1800.png", alt: "A lit candle in an upcycled 1800 Tequila bottle" },
  { src: "/images/home/rescued-bottles.jpg", alt: "A box of rescued liquor bottles waiting to be cut" },
];

const InstagramIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--home-clay)] px-7 py-3.5 text-base font-semibold !text-white shadow-[0_10px_24px_-10px_rgb(169_80_47/0.7)] transition-colors hover:bg-[var(--home-clay-hover)] active:scale-[0.98]";

export default function HomeContent({ bestsellers }: HomeContentProps) {
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
    <div className={s.page}>
      {/* HERO */}
      <section className={`${s.paper} overflow-hidden px-6 pt-12 pb-16 sm:pt-16 lg:pt-20 lg:pb-24`}>
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="text-[13px] font-semibold tracking-[0.16em] text-[var(--home-clay)] uppercase">
              Real bottles. Brighter days.
            </p>
            <h1
              className={`${serif.className} mt-5 text-[2.6rem] leading-[1.08] text-balance text-[var(--home-ink)] sm:text-5xl lg:text-[3.5rem]`}
            >
              Hand-poured in Scottsdale, one bottle at a time.
            </h1>
            <div className="mt-6 h-0.5 w-14 rounded bg-[var(--home-clay)]/70" />
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--home-muted)]">
              Natural coconut apricot wax in upcycled liquor bottles. Candles with a story, from
              our hands to yours.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link href="/shop" className={primaryButton}>
                Shop candles
                <ArrowRight size={18} />
              </Link>
              <p
                className={`${script.className} -rotate-6 text-[1.7rem] leading-none text-[var(--home-muted)]`}
                aria-hidden="true"
              >
                small batches ♡
              </p>
            </div>
          </div>

          {/* Photo collage */}
          <div className="relative mx-auto h-[310px] w-full max-w-[560px] sm:h-[460px] lg:col-span-7 lg:h-[520px] lg:max-w-none">
            <div className="absolute top-0 left-0 w-[62%] -rotate-3 sm:top-[4%] sm:left-[4%] sm:w-[56%] overflow-hidden rounded-2xl border-[6px] border-white bg-white shadow-[0_24px_50px_-18px_rgb(63_42_33/0.45)]">
              <div className="relative aspect-[4/5]">
                <Image
                  src="/images/hendricks.png"
                  alt="A lit Desert Candle Works candle poured into a Hendrick's Gin bottle"
                  fill
                  priority
                  sizes="(max-width: 1024px) 60vw, 34vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="absolute top-[16%] right-0 z-10 w-[48%] rotate-3 sm:top-[14%] sm:right-[2%] sm:w-[46%] overflow-hidden rounded-2xl border-[6px] border-white bg-white shadow-[0_24px_50px_-18px_rgb(63_42_33/0.45)]">
              <div className="relative aspect-[5/4]">
                <Image
                  src="/images/home/pour.jpg"
                  alt="Pouring natural wax into an upcycled amber bottle"
                  fill
                  sizes="(max-width: 1024px) 50vw, 28vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="absolute right-[14%] bottom-0 z-20 w-[42%] -rotate-2 sm:right-[10%] sm:bottom-[2%] sm:w-[38%] overflow-hidden rounded-2xl border-[6px] border-white bg-white shadow-[0_24px_50px_-18px_rgb(63_42_33/0.45)]">
              <div className="relative aspect-[16/10]">
                <Image
                  src="/images/scottsdale.png"
                  alt="Sonoran desert sunset near Scottsdale"
                  fill
                  sizes="(max-width: 1024px) 40vw, 22vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROMISES */}
      <section className={`${s.cream} ${s.tornTop} ${s.tornBottom} px-6 py-12`}>
        <ul className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3 sm:gap-0">
          {promises.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className={`flex items-start gap-4 sm:px-8 ${i > 0 ? "sm:border-l sm:border-[var(--home-line)]" : ""}`}
            >
              <Icon size={26} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[var(--home-clay)]" aria-hidden="true" />
              <div>
                <p className={`${serif.className} text-lg text-[var(--home-ink)]`}>{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--home-muted)]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* BEST SELLERS */}
      <section className={`${s.paper} px-0 pt-20 pb-16`}>
        <div className={`${s.reveal} relative mx-auto max-w-6xl px-6 text-center`}>
          <h2 className={`${serif.className} text-4xl text-[var(--home-ink)] sm:text-5xl`}>Best sellers</h2>
          <div className="mx-auto mt-4 h-0.5 w-12 rounded bg-[var(--home-clay)]/70" />
          <p
            className={`${script.className} absolute top-0 right-6 hidden rotate-[-6deg] text-[1.7rem] text-[var(--home-muted)] md:block`}
            aria-hidden="true"
          >
            fan favorites ♡
          </p>
        </div>
        <div className="mt-6">
          <BestSellerCarousel products={bestsellers} />
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/shop"
            className="inline-flex min-h-11 items-center gap-2 px-2 font-semibold text-[var(--home-clay)] underline decoration-[var(--home-clay)]/30 decoration-2 underline-offset-[6px] hover:decoration-[var(--home-clay)]"
          >
            Shop all candles
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* OUR SCENTS */}
      <section className={`${s.cream} ${s.tornTop} px-6 py-20`}>
        <div className="mx-auto grid max-w-7xl gap-12 xl:grid-cols-12 xl:gap-10">
          <div className={`${s.reveal} xl:col-span-4 xl:pt-10`}>
            <h2 className={`${serif.className} text-4xl text-[var(--home-ink)] sm:text-5xl`}>Our scents</h2>
            <div className="mt-4 h-0.5 w-12 rounded bg-[var(--home-clay)]/70" />
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-[var(--home-muted)]">
              Three collections: core blends that are always around, small-batch experiments, and
              scents made for the season.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 xl:col-span-8 xl:gap-5">
            <article className={`${s.reveal} ${s.blob} ${s.softShadow} bg-[var(--home-sage)]`}>
              <Sprout size={28} strokeWidth={1.6} className="text-[#5c6b4a]" aria-hidden="true" />
              <h3 className={`${serif.className} mt-4 text-2xl text-[var(--home-ink)]`}>Signature</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--home-muted)]">
                Our core, desert-inspired blends. Always in rotation, always a good idea.
              </p>
            </article>
            <article className={`${s.reveal} ${s.blobAlt} ${s.softShadow} bg-[var(--home-peach)]`}>
              <Sparkles size={28} strokeWidth={1.6} className="text-[var(--home-clay)]" aria-hidden="true" />
              <h3 className={`${serif.className} mt-4 text-2xl text-[var(--home-ink)]`}>Limited</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--home-muted)]">
                Small-batch pours on select bottles. When they&apos;re gone, they&apos;re gone.
              </p>
            </article>
            <article className={`${s.reveal} ${s.blobAlt2} ${s.softShadow} bg-[var(--home-blush)]`}>
              <Sun size={28} strokeWidth={1.6} className="text-[#a0605a]" aria-hidden="true" />
              <h3 className={`${serif.className} mt-4 text-2xl text-[var(--home-ink)]`}>Seasonal</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--home-muted)]">
                Timed to the season on select bottles. Watch our socials and newsletter for drops.
              </p>
            </article>
          </div>
        </div>

        <div className={`${s.reveal} mx-auto mt-16 max-w-7xl`}>
          <p className={`${script.className} text-[1.9rem] text-[var(--home-muted)]`}>the signature five</p>
          <ul className="mt-4 grid gap-x-10 gap-y-5 border-t border-[var(--home-line)] pt-6 sm:grid-cols-2 lg:grid-cols-5">
            {signatureScents.map(({ name, notes }) => (
              <li key={name}>
                <h3 className={`${serif.className} text-lg text-[var(--home-ink)]`}>{name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--home-muted)]">{notes}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* STORY */}
      <section className={`${s.paper} ${s.tornTop} ${s.tornBottom} overflow-hidden px-6 py-24`}>
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-12">
          <div className="relative mx-auto h-[360px] w-full max-w-[420px] sm:h-[440px] lg:col-span-5">
            <figure className={`${s.polaroid} absolute top-6 right-0 w-[62%] rotate-6`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[3px]">
                <Image
                  src="/images/home/rescued-bottles.jpg"
                  alt="A box of rescued liquor bottles waiting to be cut"
                  fill
                  sizes="260px"
                  className="object-cover"
                />
              </div>
            </figure>
            <figure className={`${s.polaroid} absolute top-10 left-0 w-[66%] -rotate-[5deg] sm:top-16`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[3px]">
                <Image
                  src="/images/home/workshop.jpg"
                  alt="Cutting a liquor bottle by hand in the Desert Candle Works workshop"
                  fill
                  sizes="280px"
                  className="object-cover"
                />
              </div>
              <figcaption className={`${script.className} absolute inset-x-0 bottom-3 text-center text-[1.35rem] text-[var(--home-muted)]`}>
                cut by hand ♡
              </figcaption>
            </figure>
          </div>

          <div className={`${s.reveal} lg:col-span-7`}>
            <p className="text-[13px] font-semibold tracking-[0.16em] text-[var(--home-clay)] uppercase">Our story</p>
            <h2 className={`${serif.className} mt-4 text-4xl leading-[1.12] text-balance text-[var(--home-ink)] sm:text-5xl`}>
              From bottles to something brighter.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--home-muted)]">
              We rescue beautiful bottles from Scottsdale bars and restaurants, then cut, sand and
              hand-pour every candle in our small workshop. What was once a celebration becomes a
              candle, and a little less glass ends up in the landfill.
            </p>
            <Link href="/about" className={`${primaryButton} mt-9`}>
              Our story
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* MAILING LIST */}
      <section className={`${s.cream} px-6 pt-24 pb-16`}>
        <div className={`${s.reveal} mx-auto max-w-2xl text-center`}>
          <h2 className={`${serif.className} text-4xl text-[var(--home-ink)] sm:text-[2.75rem]`}>
            Join our candle circle
          </h2>
          <p className="mt-4 text-lg text-[var(--home-muted)]">
            Discount codes, drops, restocks and desert-scented stories. No spam, unsubscribe anytime.
          </p>
        </div>
        <div className="mt-8">
          <MailingListSignup />
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className={`${s.cream} px-6 pt-10 pb-24`}>
        <div className="mx-auto max-w-7xl">
          <div className={`${s.reveal} text-center`}>
            <h2 className={`${serif.className} text-3xl text-[var(--home-ink)] sm:text-4xl`}>
              Follow along on Instagram
            </h2>
            <a
              href="https://instagram.com/desertcandleworks"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-2 px-2 font-semibold text-[var(--home-clay)] hover:text-[var(--home-clay-hover)]"
            >
              <InstagramIcon className="h-5 w-5" />
              @desertcandleworks
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {instagramLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl bg-[var(--home-line)]" />
                ))
              : instagramPosts.length > 0
                ? instagramPosts.map((post) => {
                    const imageUrl =
                      post.media_type === "VIDEO" ? post.thumbnail_url || post.media_url : post.media_url;
                    const captionPreview = post.caption
                      ? post.caption.substring(0, 120) + (post.caption.length > 120 ? "…" : "")
                      : "";
                    return (
                      <a
                        key={post.id}
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${s.softShadow} group relative aspect-square overflow-hidden rounded-2xl bg-[var(--home-line)]`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={post.caption || "Instagram post"}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-[rgb(63_42_33/0.72)] p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <p className="text-center text-base leading-relaxed text-white">
                            {captionPreview || "View on Instagram"}
                          </p>
                        </div>
                      </a>
                    );
                  })
                : instagramFallback.map((photo) => (
                    <a
                      key={photo.src}
                      href="https://instagram.com/desertcandleworks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${s.softShadow} group relative aspect-square overflow-hidden rounded-2xl bg-[var(--home-line)]`}
                    >
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgb(63_42_33/0.72)] p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <InstagramIcon className="h-7 w-7 text-white" />
                        <p className="text-center text-base text-white">See more on Instagram</p>
                      </div>
                    </a>
                  ))}
          </div>
        </div>
      </section>
    </div>
  );
}
