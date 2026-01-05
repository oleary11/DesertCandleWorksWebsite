import Image from "next/image";
import type { Metadata } from "next";
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


const TIMELINE: Array<{title: string; text: string; image: string; alt: string}> = [
  {
    title: "Why We Started",
    text: "We love great design, great bottles, and great candles. Tossing beautiful glass into landfills felt wrong—environmentally and aesthetically. We started Desert Candle Works to save these bottles and create clean-burning, all-natural candles that are better for you and the planet.",
    image: "/images/why.png",
    alt: "Beautiful upcycled liquor bottles transformed into eco-friendly natural candles",
  },
  {
    title: "Rescuing Bottles from Landfills",
    text: "We partner with local bars and restaurants in Scottsdale to rescue their empty bottles before they hit the trash. Every bottle we save is one less piece of glass waste in Arizona landfills. After a few late-night pickups and lots of label-saving experiments, Desert Candle Works was born.",
    image: "/images/bottles.jpg",
    alt: "Collection of empty liquor bottles being rescued from local Scottsdale bars to reduce waste",
  },
  {
    title: "Cutting & Finishing",
    text: "Each bottle is measured, cut on a wet tile saw, and hand-sanded through multiple grits for a smooth, comfortable edge. This process gives discarded glass beautiful new purpose while reducing environmental waste.",
    image: "/images/cuttingbottles.png",
    alt: "Sustainable bottle upcycling process - cutting bottles for eco-friendly candles",
  },
  {
    title: "100% Natural Coconut Apricot Wax Blend",
    text: "We use only premium, all-natural coconut apricot wax—a renewable, biodegradable blend that's completely petroleum-free. Our candles burn clean with zero toxic fumes, no black soot, and no smoke. Just pure, natural fragrance from sustainable ingredients that are safe for your family, pets, and the environment.",
    image: "/images/desert-bg.jpg",
    alt: "All-natural coconut apricot wax candle making - clean burning and eco-friendly",
  },
];

export default function About() {
  return (
    <section className="w-full">
      {/* Hero Intro */}
      <div className="mx-auto max-w-4xl text-center py-20 px-6">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-[var(--color-ink)]">
          Our Story: Natural Ingredients, Sustainable Impact
        </h1>
        <p className="text-lg text-neutral-700 mb-4">
          We create 100% natural coconut apricot wax candles that are clean burning, smokeless, and safe for your home.
        </p>
        <p className="text-base text-neutral-600">
          Every candle saves beautiful bottles from landfills—hand-poured in small batches with premium, eco-friendly ingredients.
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