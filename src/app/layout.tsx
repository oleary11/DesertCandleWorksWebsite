import "./globals.css";
import type { Metadata } from "next";
import NavBar from "../components/NavBar";

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  title: { default: "Desert Candle Works", template: "%s · Desert Candle Works" },
  description: "Warm, desert-inspired candles hand-poured into upcycled bottles.",
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