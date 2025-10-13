import "./globals.css";
import type { Metadata } from "next";
import NavBar from "../components/NavBar";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "Desert Candle Works | Upcycled Bottle Candles",
    template: "%s · Desert Candle Works",
  },
  description:
    "Hand-poured, desert-inspired soy candles made in Scottsdale, AZ — upcycled whiskey, tequila, and gin bottles with polished rims and clean burn.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: "Desert Candle Works",
    title: "Desert Candle Works | Upcycled Bottle Candles",
    description:
      "Small-batch soy candles hand-poured into upcycled spirits bottles. Clean burn, thoughtful design.",
    images: [{ url: "/images/logo.png" }], // add 1200x630 image at /public/images/og-cover.jpg
  },
  twitter: {
    card: "summary_large_image",
    title: "Desert Candle Works | Upcycled Bottle Candles",
    description:
      "Small-batch soy candles hand-poured into upcycled spirits bottles. Clean burn, thoughtful design.",
    images: ["/images/logo.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh w-full overflow-x-clip bg-[var(--color-bg)] text-[var(--color-ink)] antialiased">
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/40 border-b border-[var(--color-line)]">
          <NavBar />
        </header>

        <main className="w-full">{children}</main>

        <footer className="w-full border-t border-[var(--color-line)] mt-12">
          <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-[var(--color-muted)]">
            © {new Date().getFullYear()} Desert Candle Works ·{" "}
            <a className="underline" href="/policies">Policies</a>
          </div>
        </footer>
      </body>
    </html>
  );
}