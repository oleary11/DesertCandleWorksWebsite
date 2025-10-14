import Image from "next/image";
import BestSellerCarousel from "@/components/BestSellerCarousel";
import MailingListSignup from "@/components/MailingListSignup";
import Link from "next/link";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const revalidate = 3600;

export default async function Home() {
  const all = await listResolvedProducts();
  const bestsellers = all.filter((p) => !!p.bestSeller);

  return (
    <>
      <section
        className="
          relative isolate overflow-hidden
          w-screen left-1/2 -translate-x-1/2
          h-[420px] sm:h-[480px] lg:h-[520px]
          flex items-center justify-center text-center
          shadow-[inset_0_0_0_1px_color-mix(in_oklab,_var(--color-ink)_6%,_transparent)]
        "
      >
        <Image
          src="/images/desert-bg.jpg"
          alt="Desert dunes background"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
        <div className="relative z-10 px-6">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Hand-Poured Candles in Scottsdale, Arizona
        </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-[var(--color-muted)]">
            Locally crafted soy candles in upcycled liquor bottles. Wood wicks, clean burns, and desert-inspired scents made in Phoenix.
          </p>
          <div className="mt-8">
            <Link
              href="/shop"
              className="
                btn-cta inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
                border-0 text-white
                [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_92%,_white_8%),_color-mix(in_oklab,_var(--color-accent)_78%,_black_4%))]
                shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_30px_rgba(20,16,12,.08)]
                hover:shadow-[0_1px_0_rgba(255,255,255,.55)_inset,0_16px_40px_rgba(20,16,12,.12)]
                hover:-translate-y-0.5 transition
              "
            >
              Shop candles
            </Link>
          </div>
        </div>
      </section>

      <BestSellerCarousel products={bestsellers} />

      <div className="pb-6">
        <MailingListSignup />
      </div>
    </>
  );
}