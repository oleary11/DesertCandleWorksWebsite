"use client";

import { SCENT_GROUP_LABEL, type VariantSelection } from "./useVariantSelection";
import { chipClass, labelClass, money, optionClass } from "./styles";

function StepLabel({ n, children, aside }: { n: number; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <p className={`${labelClass} mb-0 flex items-baseline gap-2`}>
        <span className="text-xs font-semibold tabular-nums text-[var(--home-clay)]">{n}</span>
        {children}
      </p>
      {aside && <span className="text-sm text-[var(--home-muted)]">{aside}</span>}
    </div>
  );
}

/**
 * The size / wick / scent chooser. Pure presentation over useVariantSelection,
 * used by the product page and the quick-add dialog.
 */
export default function VariantOptions({ v, compact = false }: { v: VariantSelection; compact?: boolean }) {
  let step = 0;
  const gap = compact ? "space-y-5" : "space-y-7";

  return (
    <div className={gap}>
      {v.hasSizes && (
        <fieldset>
          <legend className="sr-only">Size</legend>
          <StepLabel n={++step} aside={v.size?.name}>
            Size
          </StepLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {v.sizes.map((size) => {
              const available = v.sizeAvailable(size.id);
              const selected = v.selection.size === size.id;
              return (
                <button
                  key={size.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!available}
                  onClick={() => v.selectSize(size.id)}
                  className={optionClass(selected, available)}
                >
                  <span>{size.name}</span>
                  <span className="text-xs font-normal tabular-nums text-[var(--home-muted)]">
                    {available ? money(size.priceCents / 100) : "Sold out"}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {v.wickTypes.length > 0 && (
        <fieldset>
          <legend className="sr-only">Wick</legend>
          <StepLabel n={++step} aside={v.wick?.name}>
            Wick
          </StepLabel>
          <div className="grid grid-cols-2 gap-2">
            {v.wickTypes.map((wick) => {
              const available = v.wickAvailable(wick.id);
              const selected = v.selection.wick === wick.id;
              return (
                <button
                  key={wick.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!available}
                  onClick={() => v.selectWick(wick.id)}
                  className={optionClass(selected, available)}
                >
                  <span>{wick.name}</span>
                  {!available && <span className="text-xs font-normal">Sold out</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="sr-only">Scent</legend>
        <StepLabel n={++step} aside={v.scent?.name}>
          Scent
        </StepLabel>

        {v.visibleGroups.length > 1 && (
          <div role="group" aria-label="Scent collection" className="mb-3 inline-flex rounded-full border border-[var(--home-line)] bg-white/70 p-1">
            {v.visibleGroups.map((group) => {
              const available = v.groupAvailable(group);
              const selected = v.selection.group === group;
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={selected}
                  disabled={!available}
                  onClick={() => v.selectGroup(group)}
                  className={`min-h-9 rounded-full px-4 text-sm transition-colors ${
                    selected
                      ? "bg-[var(--home-ink)] font-medium !text-white"
                      : available
                        ? "text-[var(--home-ink)] hover:bg-[var(--home-sand)]"
                        : "cursor-not-allowed text-[#b8a69a]"
                  }`}
                >
                  {SCENT_GROUP_LABEL[group]}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {v.scentsByGroup[v.selection.group].map((scent) => {
            const available = v.scentAvailable(scent.id);
            const selected = v.selection.scent === scent.id;
            return (
              <button
                key={scent.id}
                type="button"
                aria-pressed={selected}
                disabled={!available}
                onClick={() => v.selectScent(scent.id)}
                className={chipClass(selected, available)}
                title={available ? undefined : "Sold out in this wick"}
              >
                {scent.name}
                {!available && <span className="sr-only"> (sold out)</span>}
              </button>
            );
          })}
        </div>

        {v.scent?.notes && v.scent.notes.length > 0 && (
          <p className="mt-3 text-sm text-[var(--home-muted)]">
            <span className="font-medium text-[var(--home-ink)]">Notes:</span> {v.scent.notes.join(" · ")}
          </p>
        )}
      </fieldset>
    </div>
  );
}

/** "Only 1 left" / "In stock" line for the current selection. */
export function StockLine({ v }: { v: VariantSelection }) {
  return (
    <p className="text-sm" aria-live="polite">
      {v.stock <= 0 ? (
        <span className="font-medium text-[#9b3b2a]">Sold out in this combination</span>
      ) : v.stock === 1 ? (
        <span className="font-medium text-[#9b3b2a]">Only 1 left</span>
      ) : (
        <span className="text-[var(--home-muted)]">In stock</span>
      )}
      {v.quantityInCart > 0 && <span className="text-[var(--home-muted)]"> · {v.quantityInCart} in your cart</span>}
    </p>
  );
}
