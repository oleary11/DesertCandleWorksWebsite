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
  children,
}: {
  label: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "left" | "right";
  disabled?: boolean;
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
        className="a-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-[var(--a-faint)]" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className={`a-card a-fade-enter z-40 p-1.5 shadow-lg max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 sm:absolute sm:top-full sm:mt-1.5 sm:min-w-72 ${align === "right" ? "sm:right-0" : "sm:left-0"}`}
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
    <section className="border-b border-[var(--a-line)] py-7 last:border-b-0">
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
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`a-card px-4 py-3.5 ${className}`}>
      <p className="text-xs font-medium text-[var(--a-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--a-ink)]">{value}</p>
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
