import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Young_Serif } from "next/font/google";
import { ArrowRight, Flame, Leaf, Recycle } from "lucide-react";
import s from "@/components/home/home.module.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Us | All-Natural, Eco-Friendly Candles Made in Scottsdale, Arizona",
  description:
    "Discover Desert Candle Works' commitment to sustainability and natural ingredients. 100% coconut apricot wax candles in upcycled bottles—clean burning, smokeless, and environmentally friendly. Made in Scottsdale, AZ.",
  keywords: [
    "natural candles Scottsdale",
    "eco-friendly candles Arizona",
    "sustainable candles Phoenix",
    "coconut apricot wax candles Arizona",
    "coconut wax candles Scottsdale",
    "upcycled candles Scottsdale",
    "clean burning candles",
    "smokeless candles",
    "all-natural candles Arizona",
    "environmentally friendly candles",
    "zero waste candles",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Desert Candle Works | All-Natural, Eco-Friendly Candles",
    description: "100% natural coconut apricot wax candles in upcycled bottles. Clean burning, smokeless, and environmentally friendly. Made in Scottsdale, Arizona.",
    type: "website",
  },
};

const script = localFont({
  src: [{ path: "../../../public/fonts/Megastina.ttf", weight: "400", style: "normal" }],
  display: "swap",
});

const serif = Young_Serif({ weight: "400", subsets: ["latin"], display: "swap" });

const steps = [
  {
    title: "Rescue",
    text: "We partner with local bars and restaurants in Scottsdale to save their empty bottles before they hit the trash. Every bottle we keep is one less piece of glass in an Arizona landfill.",
    image: "/images/about/collected-bottles.jpg",
    alt: "Rescued liquor bottles, freshly cut and ready to be sanded",
    caption: "rescued & ready",
    tilt: "-rotate-2",
  },
  {
    title: "Cut & sand",
    text: "Each bottle is measured, cut on a wet tile saw and hand-sanded through several grits until the edge is smooth and comfortable to touch.",
    image: "/images/home/workshop.jpg",
    alt: "Cutting a liquor bottle by hand on a wet tile saw",
    caption: "cut by hand",
    tilt: "rotate-2",
  },
  {
    title: "Pour",
    text: "We fill every bottle with 100% natural coconut apricot wax: renewable, petroleum-free and clean burning, with no black soot and no smoke.",
    image: "/images/home/pour.jpg",
    alt: "Pouring natural coconut apricot wax into an upcycled bottle",
    caption: "poured in small batches",
    tilt: "-rotate-1",
  },
];

const promises = [
  { icon: Leaf, text: "100% natural coconut apricot wax" },
  { icon: Flame, text: "Clean, smokeless burn" },
  { icon: Recycle, text: "Every candle saves a bottle" },
];

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--home-clay)] px-7 py-3.5 text-base font-semibold !text-white shadow-[0_10px_24px_-10px_rgb(169_80_47/0.7)] transition-colors hover:bg-[var(--home-clay-hover)] active:scale-[0.98]";

export default function About() {
  return (
    <div className={s.page}>
      {/* MEET US */}
      <section className={`${s.paper} overflow-hidden px-6 pt-14 pb-20 sm:pt-20 lg:pb-28`}>
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <p className="text-[13px] font-semibold tracking-[0.16em] text-[var(--home-clay)] uppercase">
              Our story
            </p>
            <h1
              className={`${serif.className} mt-5 text-[2.6rem] leading-[1.08] text-balance text-[var(--home-ink)] sm:text-5xl lg:text-[3.5rem]`}
            >
              Meet Josh &amp; Cori, the faces behind Desert Candle Works.
            </h1>
            <div className="mt-6 h-0.5 w-14 rounded bg-[var(--home-clay)]/70" />
            <div className="mt-7 flex max-w-xl flex-col gap-5 text-lg leading-relaxed text-[var(--home-muted)]">
              <p>
                Josh grew up in Colorado and Cori grew up in Idaho, but Arizona has been home to both
                of us for a few years now.
              </p>
              <p>
                Cori has always loved candles but wanted something natural and clean burning. Josh has
                always loved unique alcohol bottles and hated tossing beautiful glass in the trash. So
                we combined both passions, and Desert Candle Works was born.
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[380px] lg:col-span-6 lg:max-w-[440px]">
            <figure className={`${s.polaroid} relative rotate-2`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[3px]">
                <Image
                  src="/images/about/josh-and-cori.jpg"
                  alt="Josh and Cori, the founders of Desert Candle Works"
                  fill
                  priority
                  sizes="(max-width: 1024px) 380px, 440px"
                  className="object-cover object-[50%_35%]"
                />
              </div>
              <figcaption
                className={`${script.className} absolute inset-x-0 bottom-3 text-center text-[1.7rem] text-[var(--home-muted)]`}
              >
                Josh &amp; Cori ♡
              </figcaption>
            </figure>
            <p
              className={`${script.className} absolute -bottom-10 -left-2 -rotate-6 text-[1.6rem] leading-tight text-[var(--home-muted)] sm:-left-10`}
              aria-hidden="true"
            >
              hi from Scottsdale!
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT STARTED */}
      <section className={`${s.cream} ${s.tornTop} ${s.tornBottom} px-6 py-20 sm:py-24`}>
        <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-12">
          <figure className={`${s.polaroid} relative mx-auto w-full max-w-[300px] -rotate-3 md:col-span-5`}>
            <div className="relative aspect-[3/4] overflow-hidden rounded-[3px]">
              <Image
                src="/images/home/rescued-bottles.jpg"
                alt="The first box of empty bottles, donated by a local bar"
                fill
                sizes="300px"
                className="object-cover"
              />
            </div>
            <figcaption
              className={`${script.className} absolute inset-x-0 bottom-3 text-center text-[1.4rem] text-[var(--home-muted)]`}
            >
              where it all began
            </figcaption>
          </figure>

          <div className="md:col-span-7">
            <h2 className={`${serif.className} text-4xl leading-[1.12] text-balance text-[var(--home-ink)] sm:text-[2.75rem]`}>
              It started with one small box of bottles.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--home-muted)]">
              A local bar donated a box of empties, and we spent our evenings on experimental wax
              pours. A lot of cut glass, sanded edges and test candles later, here we are.
            </p>
          </div>
        </div>
      </section>

      {/* HOW WE MAKE THEM */}
      <section className={`${s.paper} px-6 pt-24 pb-20`}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className={`${serif.className} text-4xl text-[var(--home-ink)] sm:text-5xl`}>How every candle is made</h2>
            <div className="mx-auto mt-4 h-0.5 w-12 rounded bg-[var(--home-clay)]/70" />
            <p className="mt-5 text-lg text-[var(--home-muted)]">
              By hand, in small batches, in our Scottsdale workshop.
            </p>
          </div>

          <ol className="mt-14 grid gap-14 md:grid-cols-3 md:gap-10">
            {steps.map((step, i) => (
              <li key={step.title} className={s.reveal}>
                <figure className={`${s.polaroid} relative mx-auto w-full max-w-[300px] ${step.tilt}`}>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[3px]">
                    <Image src={step.image} alt={step.alt} fill sizes="300px" className="object-cover" />
                  </div>
                  <figcaption
                    className={`${script.className} absolute inset-x-0 bottom-3 text-center text-[1.35rem] text-[var(--home-muted)]`}
                  >
                    {step.caption}
                  </figcaption>
                </figure>
                <div className="mx-auto mt-8 max-w-[320px]">
                  <p className="text-[13px] font-semibold tracking-[0.16em] text-[var(--home-clay)] uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className={`${serif.className} mt-2 text-2xl text-[var(--home-ink)]`}>{step.title}</h3>
                  <p className="mt-3 text-[16px] leading-relaxed text-[var(--home-muted)]">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PROMISES */}
      <section className={`${s.cream} ${s.tornTop} px-6 py-10`}>
        <ul className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-6 sm:flex-row sm:gap-12">
          {promises.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[var(--home-ink)]">
              <Icon size={22} strokeWidth={1.6} className="text-[var(--home-clay)]" aria-hidden="true" />
              <span className={`${serif.className} text-lg`}>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CLOSING */}
      <section className={`${s.paper} ${s.tornTop} px-6 py-24 text-center`}>
        <div className={`${s.reveal} mx-auto max-w-2xl`}>
          <p className={`${script.className} text-[2rem] text-[var(--home-muted)]`}>our goal</p>
          <h2 className={`${serif.className} mt-3 text-4xl leading-[1.15] text-balance text-[var(--home-ink)] sm:text-5xl`}>
            Good smells, cozy vibes and happy memories.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-[var(--home-muted)]">
            We want our candles to fill your home with the same happy memories they bring to ours.
            We&apos;re so grateful you&apos;re here. Your support truly means everything to us.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <Link href="/shop" className={primaryButton}>
              Shop candles
              <ArrowRight size={18} />
            </Link>
            <a
              href="https://instagram.com/desertcandleworks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 px-2 font-semibold text-[var(--home-clay)] underline decoration-[var(--home-clay)]/30 decoration-2 underline-offset-[6px] hover:decoration-[var(--home-clay)]"
            >
              Come say hi on Instagram
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
