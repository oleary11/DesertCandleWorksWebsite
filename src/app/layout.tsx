import "./globals.css";
import type { Metadata } from "next";
import NavBar from "../components/NavBar";
import { Providers } from "@/components/Providers";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "Desert Candle Works | All-Natural, Clean Burning Candles in Scottsdale, AZ",
    template: "%s · Desert Candle Works",
  },
  description:
    "100% natural coconut apricot wax candles made in Scottsdale, Arizona. Clean burning, smokeless, and eco-friendly. Upcycled liquor bottles save waste from landfills. Premium ingredients, zero toxins, safe for family and pets.",
  keywords: [
    "natural candles Scottsdale",
    "all-natural candles Arizona",
    "clean burning candles Phoenix",
    "smokeless candles Arizona",
    "coconut apricot wax candles Scottsdale",
    "coconut wax candles Arizona",
    "eco-friendly candles Phoenix",
    "sustainable candles Arizona",
    "upcycled bottle candles",
    "zero waste candles Scottsdale",
    "non-toxic candles Arizona",
    "pet safe candles Phoenix",
    "environmentally friendly candles",
    "renewable candles Arizona",
    "biodegradable candles Scottsdale",
    "clean candles Phoenix",
    "natural coconut apricot candles Arizona",
    "organic candles Scottsdale",
    "green candles Phoenix",
    "candles Scottsdale",
    "candles Phoenix",
    "candles Arizona",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: "Desert Candle Works",
    title: "Desert Candle Works | All-Natural, Eco-Friendly Candles in Scottsdale, AZ",
    description:
      "100% natural coconut apricot wax candles made in Scottsdale, Arizona. Clean burning, smokeless, and safe for your family. Upcycled bottles save waste from landfills. Premium eco-friendly ingredients.",
    images: [{ url: "/images/logo.svg" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Desert Candle Works | All-Natural, Clean Burning Candles",
    description:
      "100% natural coconut apricot wax candles in Scottsdale, AZ. Clean burning, smokeless, eco-friendly. Upcycled bottles save waste from landfills.",
    images: ["/images/logo.svg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASE}#business`,
    name: "Desert Candle Works",
    url: BASE,
    logo: `${BASE}/images/logo.svg`,
    image: `${BASE}/images/logo.svg`,
    description: "All-natural, eco-friendly candles made in Scottsdale, Arizona. 100% natural coconut apricot wax blend—clean burning, smokeless, and non-toxic. Upcycled liquor bottles save waste from landfills. Safe for family and pets.",
    priceRange: "$$",
    telephone: "",
    address: {
      "@type": "PostalAddress",
      streetAddress: "",
      addressLocality: "Scottsdale",
      addressRegion: "AZ",
      postalCode: "85251",
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "33.4942",
      longitude: "-111.9261",
    },
    areaServed: [
      {
        "@type": "City",
        name: "Scottsdale",
        "@id": "https://en.wikipedia.org/wiki/Scottsdale,_Arizona",
      },
      {
        "@type": "City",
        name: "Phoenix",
        "@id": "https://en.wikipedia.org/wiki/Phoenix,_Arizona",
      },
      {
        "@type": "State",
        name: "Arizona",
        "@id": "https://en.wikipedia.org/wiki/Arizona",
      },
    ],
    sameAs: [
      "https://www.instagram.com/desertcandleworks/",
      "https://www.facebook.com/profile.php?id=61582095448990",
    ],
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "All-Natural, Eco-Friendly Upcycled Bottle Candles",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Product",
            name: "100% Natural Coconut Apricot Wax Candles in Upcycled Bottles",
            description: "All-natural, clean burning coconut apricot wax candles. Smokeless, non-toxic, and eco-friendly. Poured into upcycled liquor bottles rescued from landfills. Safe for family and pets.",
            brand: {
              "@type": "Brand",
              name: "Desert Candle Works",
            },
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "USD",
              lowPrice: "20.00",
              highPrice: "45.00",
              offerCount: "15",
              availability: "https://schema.org/InStock",
            },
          },
        },
      ],
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}#organization`,
    name: "Desert Candle Works",
    url: BASE,
    logo: `${BASE}/images/logo.svg`,
    description: "All-natural, eco-friendly candles made in Scottsdale, Arizona. 100% natural coconut apricot wax blend, clean burning, smokeless, and non-toxic. Upcycled bottles save waste from landfills.",
    founder: {
      "@type": "Person",
      name: "Desert Candle Works Team",
    },
    foundingLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Scottsdale",
        addressRegion: "AZ",
        addressCountry: "US",
      },
    },
  };

  // WebSite schema for sitelinks search box in Google
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE}#website`,
    name: "Desert Candle Works",
    url: BASE,
    description: "All-natural coconut apricot wax candles made in Scottsdale, Arizona. Clean burning, smokeless, eco-friendly candles in upcycled bottles.",
    publisher: {
      "@id": `${BASE}#organization`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // FAQ schema for common questions - helps get rich snippets in search results
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What makes Desert Candle Works candles different?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Our candles are made with 100% natural coconut apricot wax, which burns cleaner and longer than paraffin or soy. We pour them into upcycled liquor bottles rescued from local Scottsdale bars, reducing landfill waste while creating beautiful, sustainable home decor.",
        },
      },
      {
        "@type": "Question",
        name: "Are your candles safe for pets and children?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Our coconut apricot wax is 100% natural, non-toxic, and petroleum-free. It burns clean with no black soot or smoke, making it safe for your family and pets when used as directed.",
        },
      },
      {
        "@type": "Question",
        name: "Where are Desert Candle Works candles made?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "All our candles are hand-poured in small batches in Scottsdale, Arizona. We source our bottles from local bars and restaurants in the Phoenix metro area.",
        },
      },
      {
        "@type": "Question",
        name: "Do you offer local pickup in Scottsdale?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! We offer free local pickup in Scottsdale and the greater Phoenix area. Select 'Local Pickup' at checkout to arrange a pickup time.",
        },
      },
      {
        "@type": "Question",
        name: "What is coconut apricot wax?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Coconut apricot wax is a premium, all-natural wax blend made from coconut and apricot oils. It's renewable, biodegradable, and burns cleaner than traditional paraffin wax with excellent scent throw and longer burn times.",
        },
      },
      {
        "@type": "Question",
        name: "Do you ship candles nationwide?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! We ship our candles across the United States. Each candle is carefully packaged to ensure it arrives safely at your door.",
        },
      },
    ],
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className="min-h-dvh w-full overflow-x-clip bg-[var(--color-bg)] text-[var(--color-ink)] antialiased flex flex-col">
        <Providers>
          <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/40 border-b border-[var(--color-line)]">
            <NavBar />
          </header>

          <main className="w-full flex-1">{children}</main>

          <footer className="w-full border-t border-[var(--color-line)] mt-auto">
            <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-[var(--color-muted)] text-center">
              © {new Date().getFullYear()} Desert Candle Works ·{" "}
              <a className="underline hover:text-[var(--color-ink)] transition" href="/faq">FAQ</a>
              {" · "}
              <a className="underline hover:text-[var(--color-ink)] transition" href="/policies">Policies</a>
              {" · "}
              <a className="underline hover:text-[var(--color-ink)] transition" href="https://desertcandleworks.faire.com" target="_blank" rel="noopener noreferrer">Wholesale</a>
              {" · "}
              <span>Scottsdale, AZ</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}