import type { Metadata } from "next";
import s from "@/components/home/home.module.css";
import { serif } from "@/lib/storefrontFonts";
import { SIGNATURE_SCENT_NAMES } from "@/lib/signatureScents";
import RefillForm from "./RefillForm";

export const metadata: Metadata = {
  title: "Bottle Refills",
  description:
    "Burned through your Desert Candle Works candle? Send the bottle back and we'll refill it with natural coconut apricot wax in one of our signature scents for $20.",
  alternates: { canonical: "/refills" },
};

export const revalidate = 3600;

const steps = [
  { title: "Tell us about it", body: "Fill out the form below. It's free, and you'll get an email with what to do next." },
  {
    title: "Send us the bottle",
    body: "Mail it to us (you cover the shipping), or drop it off in Scottsdale. Pack it well: bubble wrap and a snug box.",
  },
  {
    title: "Pay once it arrives",
    body: "When your bottle gets here in one piece, we email a link to pay $20 plus return shipping, or $20 for local pickup. If it breaks on the way, you pay nothing.",
  },
  { title: "We pour it fresh", body: "Your bottle comes back as a brand new candle in the scent you picked." },
];

export default async function RefillsPage({ searchParams }: { searchParams: Promise<{ paid?: string; pay?: string }> }) {
  const { paid, pay } = await searchParams;

  return (
    <div className={`${s.page} s-ui`}>
      <section className={`${s.cream} px-6 pb-24 pt-12 sm:pt-16`}>
        <div className="mx-auto max-w-6xl">
          {paid && (
            <p role="status" className="mb-8 rounded-2xl bg-[var(--home-sage)] px-5 py-4 text-[var(--home-ink)]">
              Thank you! Your refill is paid. We&apos;ll pour it and let you know when it&apos;s on its way.
            </p>
          )}
          {pay === "invalid" && (
            <p role="alert" className="mb-8 rounded-2xl bg-[#f6e3dc] px-5 py-4 text-[var(--home-ink)]">
              That payment link isn&apos;t valid anymore. Reply to your refill email and we&apos;ll sort it out.
            </p>
          )}
          <div className="grid items-start gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--home-clay)]">Bottle refills</p>
              <h1 className={`${serif.className} mt-4 text-[2.5rem] leading-[1.08] text-[var(--home-ink)] sm:text-5xl`}>
                Give your bottle another life
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-[var(--home-muted)]">
                Burned all the way down? Send your Desert Candle Works bottle back and we&apos;ll refill it for $20 in one of
                our five signature scents.
              </p>
              <ol className="mt-8 space-y-5">
                {steps.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--home-clay)] text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-[var(--home-ink)]">{step.title}</p>
                      <p className="mt-1 text-[15px] leading-relaxed text-[var(--home-muted)]">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lg:col-span-7">
              <RefillForm scents={SIGNATURE_SCENT_NAMES} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
