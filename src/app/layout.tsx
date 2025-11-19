import "./globals.css";
import type { Metadata } from "next";
import NavBar from "../components/NavBar";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "Desert Candle Works | Hand-Poured Candles in Scottsdale, AZ",
    template: "%s · Desert Candle Works",
  },
  description:
    "Hand-poured soy candles in Scottsdale, Arizona. Upcycled liquor bottle candles with wood wicks. Shop local Phoenix candles, eco-friendly gifts, and desert-inspired scents.",
  keywords: [
    "candles Scottsdale",
    "candles Phoenix",
    "candles Arizona",
    "handmade candles Scottsdale",
    "soy candles Phoenix",
    "upcycled bottle candles",
    "wood wick candles Arizona",
    "local candles near me",
    "Scottsdale gifts",
    "Phoenix handmade",
    "Arizona made candles",
    "desert candles",
    "liquor bottle candles",
    "eco-friendly candles Arizona",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: "Desert Candle Works",
    title: "Desert Candle Works | Hand-Poured Candles in Scottsdale, AZ",
    description:
      "Hand-poured soy candles made in Scottsdale, Arizona. Upcycled liquor bottles with wood wicks and desert-inspired scents. Shop local Phoenix candles.",
    images: [{ url: "/images/logo.svg" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Desert Candle Works | Hand-Poured Candles in Scottsdale, AZ",
    description:
      "Hand-poured soy candles made in Scottsdale, Arizona. Upcycled bottles with wood wicks and desert scents.",
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
    description: "Hand-poured, desert-inspired soy candles made in Scottsdale, Arizona. Upcycled liquor bottles with premium soy wax, wood wicks, and clean burns.",
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
      name: "Upcycled Bottle Candles",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Product",
            name: "Hand-Poured Soy Candles in Upcycled Bottles",
            description: "Premium soy wax candles poured into upcycled liquor bottles with wood wicks",
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
    description: "Small-batch, handcrafted candles made in Scottsdale, Arizona",
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
      </body>
    </html>
  );
}