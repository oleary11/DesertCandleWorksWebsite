"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

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
