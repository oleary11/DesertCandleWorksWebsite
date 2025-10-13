import Image from "next/image";
import type { Metadata } from "next";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Desert Candle Works",
  description:
    "Why we started, how we upcycle bottles into candles, and our small-batch process in Scottsdale, AZ.",
  alternates: { canonical: "/about" },
};


const TIMELINE = [
  {
    title: "Why We Started",
    text: "We love great design, great bottles, and great candles. Tossing beautiful glass felt wrong—so we began giving bottles a second life with warm, desert-inspired scents.",
    image: "/images/why.png",
  },
  {
    title: "How We Began",
    text: "We reached out to local bars and restaurants in Scottsdale to rescue their empty bottles. After a few late-night pickups and lots of label-saving experiments, Desert Candle Works was born.",
    image: "/images/bottles.jpg",
  },
  {
    title: "Cutting & Finishing",
    text: "Each bottle is measured, cut on a wet tile saw, and hand-sanded. We sand the rim through multiple grits for a smooth, comfortable edge that looks as good as it feels.",
    image: "/images/cuttingbottles.png",
  },
  {
    title: "Pouring Small Batches",
    text: "We melt premium soy wax, set centered wicks, and pour in small batches—testing every vessel for clean, even burns with a soft crackle when wood wicks are used.",
    image: "/images/desert-bg.jpg",
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
                alt={item.title}
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