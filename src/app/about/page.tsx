import Image from "next/image";
import type { Metadata } from "next";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Us | Hand-Poured Candles Made in Scottsdale, Arizona",
  description:
    "Learn how Desert Candle Works creates hand-poured soy candles in Scottsdale, AZ. Our story, upcycling process, and small-batch candle making with local Arizona bottles.",
  keywords: [
    "Scottsdale candle maker",
    "Arizona candle company",
    "handmade candles Scottsdale",
    "local candle business",
    "upcycled candles Arizona",
    "small batch candles",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Desert Candle Works | Scottsdale Candle Makers",
    description: "Hand-poured soy candles made in Scottsdale, Arizona. Learn our upcycling process and small-batch candle making story.",
    type: "website",
  },
};


const TIMELINE: Array<{title: string; text: string; image: string; alt: string}> = [
  {
    title: "Why We Started",
    text: "We love great design, great bottles, and great candles. Tossing beautiful glass felt wrong—so we began giving bottles a second life with warm, desert-inspired scents.",
    image: "/images/why.png",
    alt: "Beautiful upcycled liquor bottles transformed into handmade candles",
  },
  {
    title: "How We Began",
    text: "We reached out to local bars and restaurants in Scottsdale to rescue their empty bottles. After a few late-night pickups and lots of label-saving experiments, Desert Candle Works was born.",
    image: "/images/bottles.jpg",
    alt: "Collection of empty liquor bottles being rescued from local Scottsdale bars",
  },
  {
    title: "Cutting & Finishing",
    text: "Each bottle is measured, cut on a wet tile saw, and hand-sanded. We sand the rim through multiple grits for a smooth, comfortable edge that looks as good as it feels.",
    image: "/images/cuttingbottles.png",
    alt: "Bottle being precisely cut on a wet tile saw for candle making",
  },
  {
    title: "Pouring Small Batches",
    text: "We melt premium soy wax, set centered wicks, and pour in small batches—testing every vessel for clean, even burns with a soft crackle when wood wicks are used.",
    image: "/images/desert-bg.jpg",
    alt: "Small batch candle making process with premium soy wax",
  },
];

export default function About() {
  return (
    <section className="w-full">
      {/* Hero Intro */}
      <div className="mx-auto max-w-4xl text-center py-20 px-6">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-[var(--color-ink)]">
          Our Story
        </h1>
        <p className="text-lg text-neutral-700">
          We hand-pour warm, desert-inspired candles into upcycled bottles in small batches.
        </p>
      </div>

      {/* Timeline Sections */}
      {TIMELINE.map((item, i) => {
        const reverse = i % 2 !== 0;
        return (
          <div
            key={item.title}
            className={`relative flex flex-col md:flex-row ${
              reverse ? "md:flex-row-reverse" : ""
            }`}
          >
            {/* Image side */}
            <div className="relative w-full md:w-1/2 h-[60vh] md:h-[80vh] overflow-hidden">
              <Image
                src={item.image}
                alt={item.alt}
                fill
                className="object-cover object-center scale-105"
                sizes="100vw"
              />
            </div>

            {/* Text side */}
            <div className="flex w-full md:w-1/2 items-center justify-center bg-white px-8 py-16 md:py-0">
              <div className="max-w-md text-center md:text-left">
                <h2 className="text-2xl font-semibold mb-3 text-[var(--color-ink)]">
                  {item.title}
                </h2>
                <p className="text-neutral-700 leading-relaxed">{item.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}