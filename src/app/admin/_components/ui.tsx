"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

/** Dropdown menu anchored to a button. Closes on outside click and Escape. */
export function Menu({
  label,
  open,
  onOpenChange,
  align = "right",
  disabled,
  primary,
  panel,
  children,
}: {
  label: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "left" | "right";
  disabled?: boolean;
  /** Dark primary trigger button. */
  primary?: boolean;
  /** Content is a small form, not a list of actions. */
  panel?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`a-btn ${primary ? "a-btn-primary" : ""}`}
        aria-haspopup={panel ? "dialog" : "menu"}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 ${primary ? "text-white/70" : "text-[var(--a-faint)]"}`} aria-hidden />
      </button>
      {open && (
        <div
          role={panel ? "dialog" : "menu"}
          className={`a-card a-fade-enter z-40 ${panel ? "p-4 sm:w-80" : "p-1.5"} shadow-lg max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 sm:absolute sm:top-full sm:mt-1.5 sm:min-w-72 ${align === "right" ? "sm:right-0" : "sm:left-0"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="a-section-label px-2.5 pb-1 pt-2 text-[var(--a-faint)] first:pt-1">{children}</p>;
}

export function MenuItem({
  icon,
  children,
  hint,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" className="a-menu-item" {...props}>
      {icon && <span className="text-[var(--a-muted)]">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {hint && <span className="block text-xs font-normal text-[var(--a-muted)]">{hint}</span>}
      </span>
    </button>
  );
}

/** Compact select for filter toolbars; the label is announced but not shown. */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      className={`a-select ${value !== "all" ? "a-select-active" : ""}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "amber" | "green" | "red" | "blue";
  children: React.ReactNode;
}) {
  return <span className={`a-badge a-badge-${tone}`}>{children}</span>;
}

/** A titled block inside a form or editor, separated from the next by a hairline. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--a-line)] py-7 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--a-ink)]">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-[var(--a-muted)]">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Pill-style single choice (e.g. status tabs). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-[var(--a-line)] bg-[var(--a-canvas)] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)] ${
              active ? "bg-white font-medium text-[var(--a-ink)] shadow-sm" : "text-[var(--a-muted)] hover:text-[var(--a-ink)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small summary number with a label. */
export function Stat({
  label,
  value,
  hint,
  tone,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Colors the value for signed amounts like profit. */
  tone?: "good" | "bad";
  className?: string;
}) {
  const valueColor = tone === "good" ? "text-[var(--a-good)]" : tone === "bad" ? "text-[var(--a-bad)]" : "text-[var(--a-ink)]";
  return (
    <div className={`a-card px-4 py-3.5 ${className}`}>
      <p className="text-xs font-medium text-[var(--a-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--a-muted)]">{hint}</p>}
    </div>
  );
}

/** Centered dialog with header, scrollable body and optional footer. Escape and backdrop close it unless `busy`. */
export function Modal({
  title,
  description,
  onClose,
  busy,
  footer,
  size = "md",
  children,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  return (
    <div className="a-ui fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="a-fade-enter absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className={`a-card a-fade-enter relative flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-b-none shadow-2xl sm:rounded-b-[var(--a-radius)]`}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--a-line)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--a-ink)]">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-[var(--a-muted)]">{description}</p>}
          </div>
          <button type="button" className="a-icon-btn -mr-2 shrink-0" onClick={onClose} disabled={busy} aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--a-line)] bg-[var(--a-canvas)] px-5 py-3 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Underlined tab bar. Pass `value: null` when no tab should look selected. */
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  tabs: { value: T; label: React.ReactNode; count?: number }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto [scrollbar-width:none] shadow-[inset_0_-1px_0_var(--a-line)]">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)] ${
              active ? "border-[var(--a-ink)] text-[var(--a-ink)]" : "border-transparent text-[var(--a-muted)] hover:text-[var(--a-ink)]"
            }`}
          >
            {t.label}
            {t.count ? (
              <span className="rounded-full bg-[var(--a-ink)] px-1.5 py-px text-[11px] font-semibold leading-4 text-white">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** On/off toggle that acts immediately. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)] focus-visible:ring-offset-2 ${
        checked ? "bg-[#2f7a4a]" : "bg-[var(--a-line-strong)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
      />
    </button>
  );
}

/** Titled card section. */
export function Panel({
  title,
  description,
  actions,
  className = "",
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`a-card p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--a-ink)]">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-[var(--a-muted)]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

const VIZ_SLOTS = ["var(--a-viz-1)", "var(--a-viz-2)", "var(--a-viz-3)", "var(--a-viz-4)"];

/**
 * How a total splits into parts: one stacked bar plus a legend with values.
 * Up to four parts; colors follow the item order, never the size.
 */
export function Composition({
  items,
  format,
}: {
  items: { label: string; value: number }[];
  format: (value: number) => string;
}) {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.value), 0);
  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-[var(--a-viz-track)]" role="img" aria-label={items.map((i) => `${i.label} ${format(i.value)}`).join(", ")}>
        {total > 0 &&
          items.map((item, idx) =>
            item.value > 0 ? (
              <div
                key={item.label}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(item.value / total) * 100}%`, background: VIZ_SLOTS[idx % VIZ_SLOTS.length] }}
                title={`${item.label}: ${format(item.value)} (${((item.value / total) * 100).toFixed(1)}%)`}
              />
            ) : null
          )}
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        {items.map((item, idx) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: VIZ_SLOTS[idx % VIZ_SLOTS.length] }} aria-hidden />
            <dt className="flex-1 text-[var(--a-muted)]">{item.label}</dt>
            <dd className="tabular-nums text-[var(--a-ink)]">{format(item.value)}</dd>
            <dd className="w-12 text-right text-xs tabular-nums text-[var(--a-faint)]">
              {total > 0 ? `${((Math.max(0, item.value) / total) * 100).toFixed(0)}%` : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ranked horizontal bars for a single measure (one hue). */
export function RankedBars({
  items,
  format,
  limit = 10,
}: {
  items: { label: string; value: number; sub?: string }[];
  format: (value: number) => string;
  limit?: number;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, limit);
  const max = Math.max(...sorted.map((i) => i.value), 0);
  if (sorted.length === 0) return <p className="py-6 text-center text-sm text-[var(--a-muted)]">No data for this period.</p>;
  return (
    <ol className="space-y-3">
      {sorted.map((item) => (
        <li key={item.label} className="group" title={`${item.label}: ${format(item.value)}${item.sub ? ` · ${item.sub}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-[var(--a-ink)]">{item.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium text-[var(--a-ink)]">{format(item.value)}</span>
              {item.sub && <span className="ml-2 text-xs text-[var(--a-muted)]">{item.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--a-viz-track)]">
            <div
              className="h-full rounded-full bg-[var(--a-viz-single)] transition-opacity group-hover:opacity-80"
              style={{ width: `${max > 0 ? Math.max(2, (item.value / max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Date preset dropdown, with start/end pickers when "custom" is chosen. */
export function DateRange<T extends string>({
  preset,
  presets,
  onPreset,
  customStart,
  customEnd,
  onCustomStart,
  onCustomEnd,
  onApply,
}: {
  preset: T;
  presets: { value: T; label: string }[];
  onPreset: (preset: T) => void;
  customStart: string;
  customEnd: string;
  onCustomStart: (v: string) => void;
  onCustomEnd: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="sr-only">Date range</span>
        <select className="a-select min-w-44 text-[var(--a-ink)]" value={preset} onChange={(e) => onPreset(e.target.value as T)}>
          {presets.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {preset === "custom" && (
        <>
          <label className="block">
            <span className="sr-only">Start date</span>
            <input type="date" className="a-input" value={customStart} onChange={(e) => onCustomStart(e.target.value)} />
          </label>
          <span className="pb-2.5 text-sm text-[var(--a-muted)]">to</span>
          <label className="block">
            <span className="sr-only">End date</span>
            <input type="date" className="a-input" value={customEnd} onChange={(e) => onCustomEnd(e.target.value)} />
          </label>
          <button type="button" className="a-btn a-btn-primary" onClick={onApply} disabled={!customStart || !customEnd}>
            Apply
          </button>
        </>
      )}
    </div>
  );
}
