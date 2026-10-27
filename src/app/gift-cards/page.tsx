import type { Metadata } from "next";
import s from "@/components/home/home.module.css";
import { serif } from "@/lib/storefrontFonts";
import GiftCardForm from "./GiftCardForm";

export const metadata: Metadata = {
  title: "Gift Cards",
  description:
    "Give a Desert Candle Works gift card: hand-poured coconut apricot wax candles in upcycled liquor bottles. Emailed instantly or on the day you choose, and it never expires.",
  alternates: { canonical: "/gift-cards" },
};

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return (
    <div className={`${s.page} s-ui`}>
      <section className={`${s.cream} px-6 pb-24 pt-12 sm:pt-16`}>
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5 lg:pt-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--home-clay)]">Gift cards</p>
            <h1 className={`${serif.className} mt-4 text-[2.5rem] leading-[1.08] text-[var(--home-ink)] sm:text-5xl`}>
              The candle gift that&apos;s never out of stock
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[var(--home-muted)]">
              Let them pick their own scent and bottle. We&apos;ll email the gift card right away or on the day you
              choose, with your note.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-[var(--home-ink)]">
              <li>• Works on everything in the shop, and with our sales</li>
              <li>• Whatever they don&apos;t spend stays on the card</li>
              <li>• Never expires</li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            {status === "success" ? (
              <div className="rounded-3xl bg-white p-8 text-center shadow-[0_20px_44px_-28px_rgb(63_42_33/0.4)] ring-1 ring-[var(--home-line)]">
                <h2 className={`${serif.className} text-3xl text-[var(--home-ink)]`}>Thank you!</h2>
                <p className="mt-3 text-[var(--home-muted)]">
                  Your gift card is all set. We&apos;ve emailed you a receipt with the code, and the gift card goes to
                  them on the day you picked.
                </p>
              </div>
            ) : (
              <GiftCardForm />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
