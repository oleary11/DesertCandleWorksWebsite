/**
 * Shared class strings for the shop, product and cart pages. They build on the
 * homepage tokens (--home-*) from home.module.css, so every storefront page
 * reads as one shop.
 */

export const btnPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--home-clay)] px-6 text-[15px] font-semibold !text-white shadow-[0_10px_24px_-12px_rgb(169_80_47/0.7)] transition-colors hover:bg-[var(--home-clay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)] focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c9a898] disabled:shadow-none";

export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[var(--home-ink)] bg-transparent px-6 text-[15px] font-semibold text-[var(--home-ink)] transition-colors hover:bg-[var(--home-ink)] hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[var(--home-line)] disabled:text-[#b8a69a] disabled:hover:bg-transparent";

export const btnQuiet =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--home-line)] bg-white px-5 text-sm font-medium text-[var(--home-ink)] transition-colors hover:border-[var(--home-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Selectable option (wick, size, scent collection). Pair with aria-pressed. */
export function optionClass(selected: boolean, available: boolean) {
  if (!available) {
    return "relative flex min-h-12 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--home-line)] px-3 py-2 text-sm text-[#a8958a] cursor-not-allowed";
  }
  return selected
    ? "relative flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-[var(--home-ink)] bg-white px-3 py-2 text-sm font-semibold text-[var(--home-ink)] shadow-[0_6px_16px_-10px_rgb(63_42_33/0.5)]"
    : "relative flex min-h-12 flex-col items-center justify-center rounded-xl border border-[var(--home-line)] bg-white/70 px-3 py-2 text-sm text-[var(--home-ink)] transition-colors hover:border-[var(--home-ink)]";
}

/** Small round chip (filters, scents). Pair with aria-pressed. */
export function chipClass(selected: boolean, available = true) {
  if (!available) {
    return "inline-flex min-h-10 items-center rounded-full border border-dashed border-[var(--home-line)] px-4 text-sm text-[#a8958a] line-through decoration-[#a8958a]/60 cursor-not-allowed";
  }
  return selected
    ? "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--home-ink)] bg-[var(--home-ink)] px-4 text-sm font-medium !text-white"
    : "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--home-line)] bg-white/80 px-4 text-sm text-[var(--home-ink)] transition-colors hover:border-[var(--home-ink)]";
}

export const fieldClass =
  "w-full min-h-12 rounded-xl border border-[var(--home-line)] bg-white px-4 text-[15px] text-[var(--home-ink)] placeholder:text-[#a8958a] transition-colors hover:border-[#cdb8a8] focus:border-[var(--home-clay)] focus:outline-none focus:ring-2 focus:ring-[var(--home-clay)]/25";

export const labelClass = "mb-2 block text-sm font-semibold text-[var(--home-ink)]";

export function money(dollars: number) {
  return `$${dollars.toFixed(2)}`;
}
