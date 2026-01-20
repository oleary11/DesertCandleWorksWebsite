import type { Metadata } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Desert Candle Works",
  description:
    "Find answers about our all-natural coconut apricot wax candles. Learn about our eco-friendly process, shipping, local pickup in Scottsdale, and what makes our candles safe for pets and family.",
  keywords: [
    "candle FAQ",
    "coconut apricot wax questions",
    "natural candle safety",
    "Scottsdale candle shop",
    "eco-friendly candles FAQ",
    "pet safe candles",
    "local pickup Scottsdale",
  ],
  alternates: { canonical: `${BASE}/faq` },
  openGraph: {
    title: "FAQ | Desert Candle Works - Scottsdale, Arizona",
    description:
      "Common questions about our all-natural, eco-friendly candles. Learn about coconut apricot wax, shipping, local pickup, and more.",
    url: `${BASE}/faq`,
    type: "website",
  },
};

const FAQS = [
  {
    question: "What makes Desert Candle Works candles different?",
    answer:
      "Our candles are made with 100% natural coconut apricot wax, which burns cleaner and longer than paraffin or soy. We pour them into upcycled liquor bottles rescued from local Scottsdale bars, reducing landfill waste while creating beautiful, sustainable home decor.",
  },
  {
    question: "Are your candles safe for pets and children?",
    answer:
      "Yes! Our coconut apricot wax is 100% natural, non-toxic, and petroleum-free. It burns clean with no black soot or smoke, making it safe for your family and pets when used as directed. Always keep burning candles out of reach of children and pets.",
  },
  {
    question: "Where are Desert Candle Works candles made?",
    answer:
      "All our candles are hand-poured in small batches in Scottsdale, Arizona. We source our bottles from local bars and restaurants in the Phoenix metro area, giving beautiful glass a second life.",
  },
  {
    question: "Do you offer local pickup in Scottsdale?",
    answer:
      "Yes! We offer free local pickup in Scottsdale and the greater Phoenix area. Select 'Local Pickup' at checkout and we'll reach out to arrange a convenient pickup time.",
  },
  {
    question: "What is coconut apricot wax?",
    answer:
      "Coconut apricot wax is a premium, all-natural wax blend made from coconut and apricot oils. It's renewable, biodegradable, and burns cleaner than traditional paraffin wax with excellent scent throw and longer burn times. It also has a beautiful creamy appearance.",
  },
  {
    question: "Do you ship candles nationwide?",
    answer:
      "Yes! We ship our candles across the United States. Each candle is carefully packaged with protective materials to ensure it arrives safely at your door.",
  },
  {
    question: "How long do your candles burn?",
    answer:
      "Burn time varies by size, but our candles typically burn for 40-60+ hours depending on the bottle size. Coconut apricot wax has a slower, cooler burn than paraffin, giving you more hours of enjoyment.",
  },
  {
    question: "Why do you use upcycled bottles?",
    answer:
      "We believe beautiful things shouldn't end up in landfills. By rescuing bottles from local Scottsdale bars and restaurants, we reduce waste while creating unique, one-of-a-kind candles. Each bottle has its own character and story.",
  },
  {
    question: "How should I care for my candle?",
    answer:
      "For the best burn, trim your wick to about 1/4 inch before each lighting. On the first burn, let the wax melt all the way to the edges to prevent tunneling. Never burn for more than 4 hours at a time, and always place on a heat-resistant surface.",
  },
  {
    question: "Can I reuse the bottle after the candle is finished?",
    answer:
      "Absolutely! Once your candle is done, clean out any remaining wax with warm water. The bottle makes a beautiful vase, drinking glass, or storage container. That's the beauty of upcycling—it keeps giving.",
  },
  {
    question: "Do you offer wholesale or bulk orders?",
    answer:
      "Yes, we work with local businesses, event planners, and gift shops. Contact us through our contact page to discuss wholesale pricing and custom orders.",
  },
  {
    question: "Are your fragrances natural?",
    answer:
      "We use high-quality fragrance oils that are phthalate-free and formulated to be safe for home use. Combined with our natural coconut apricot wax, you get a clean, consistent scent throw without harmful chemicals.",
  },
];

export default function FAQPage() {
  // FAQ schema for this specific page
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <section className="py-12 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-center mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-center text-[var(--color-muted)] mb-12">
          Everything you need to know about our all-natural, eco-friendly candles.
        </p>

        <div className="space-y-6">
          {FAQS.map((faq, index) => (
            <details
              key={index}
              className="group border border-[var(--color-line)] rounded-lg overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer bg-white hover:bg-neutral-50 transition-colors">
                <h2 className="text-lg font-medium text-left pr-4">{faq.question}</h2>
                <span className="flex-shrink-0 text-[var(--color-muted)] group-open:rotate-180 transition-transform">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 pt-2 text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-line)] bg-neutral-50/50">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[var(--color-muted)] mb-4">
            Still have questions? We&apos;d love to hear from you.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-ink)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Contact Us
          </a>
        </div>
      </div>
    </section>
  );
}
