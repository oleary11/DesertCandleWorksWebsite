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
              <a className="underline hover:text-[var(--color-ink)] transition" href="/policies">Policies</a>
              {" · "}
              <span>Scottsdale, AZ</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}