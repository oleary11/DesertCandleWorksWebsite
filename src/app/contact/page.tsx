import ContactForm from "./ContactForm";
import type { Metadata } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";

export const metadata: Metadata = {
  title: "Contact Us | Desert Candle Works - Scottsdale, Arizona",
  description:
    "Get in touch with Desert Candle Works in Scottsdale, AZ. Questions about our all-natural coconut apricot wax candles, wholesale inquiries, custom orders, or local pickup. We'd love to hear from you!",
  keywords: [
    "contact Desert Candle Works",
    "Scottsdale candle shop contact",
    "Arizona candle maker",
    "wholesale candles Arizona",
    "custom candle orders Scottsdale",
    "local candles Phoenix",
    "candle shop near me",
  ],
  alternates: { canonical: `${BASE}/contact` },
  openGraph: {
    title: "Contact Desert Candle Works | Scottsdale, Arizona",
    description:
      "Questions about our all-natural candles? Wholesale inquiries? Custom orders? Get in touch with Desert Candle Works in Scottsdale, AZ.",
    url: `${BASE}/contact`,
    type: "website",
  },
};

export default function Contact() {
  return (
    <section className="flex items-center justify-center bg-[var(--color-bg)] py-12 px-6">
      <ContactForm />
    </section>
  );
}
