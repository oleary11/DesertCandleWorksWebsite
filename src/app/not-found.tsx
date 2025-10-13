// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="min-h-dvh flex items-center justify-center px-6">
      <div
        className="
          card p-8 max-w-xl text-center
          shadow-[inset_0_0_0_1px_color-mix(in_oklab,_var(--color-ink)_6%,_transparent)]
        "
      >
        <div className="text-6xl mb-4" aria-hidden>🕯️</div>
        <h1 className="text-2xl font-semibold tracking-tight">404 — Wick’d Problem</h1>

        <p className="mt-3 text-[var(--color-muted)]">
          We looked everywhere, but this page has <em>burned out</em>.
          Try heading back before the wax sets.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="
              btn-cta inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium
              [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_92%,_white_8%),_color-mix(in_oklab,_var(--color-accent)_78%,_black_4%))]
              shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_30px_rgba(20,16,12,.08)]
              hover:shadow-[0_1px_0_rgba(255,255,255,.55)_inset,0_16px_40px_rgba(20,16,12,.12)]
              hover:-translate-y-0.5 transition
              text-[var(--color-accent-ink)]
            "
          >
            Take me home
          </Link>

          <Link href="/shop" className="btn">
            Shop candles
          </Link>
        </div>

        <div className="mt-6 text-xs text-[var(--color-muted)]">
          Tip: if you typed the URL, double-check the spelling. (We know, our slugs are
          <span className="whitespace-nowrap"> a-lot-to-handle 😅</span>)
        </div>
      </div>
    </section>
  );
}