"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { DASHBOARD_ITEM, NAV_GROUPS, type NavItem } from "./nav";

type Entry = NavItem & { group: string };

const ENTRIES: Entry[] = [
  { ...DASHBOARD_ITEM, group: "" },
  ...NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))),
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter((e) =>
      `${e.title} ${e.description} ${e.group}`.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  function go(entry: Entry | undefined) {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[activeIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="a-ui fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Jump to a page">
      <button type="button" aria-label="Close" className="a-fade-enter absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="a-card a-fade-enter relative w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--a-line)] px-4 focus-within:shadow-[inset_0_-2px_0_var(--a-accent)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--a-faint)]" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page…"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={results[activeIdx] ? `admin-palette-${activeIdx}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-12 flex-1 bg-transparent text-[15px] text-[var(--a-ink)] outline-none placeholder:text-[var(--a-faint)]"
          />
          <span className="a-kbd">Esc</span>
        </div>

        <ul ref={listRef} id="admin-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-[var(--a-muted)]">No pages match “{query}”.</li>
          )}
          {results.map((entry, idx) => {
            const Icon = entry.icon;
            const active = idx === activeIdx;
            return (
              <li
                key={entry.href}
                id={`admin-palette-${idx}`}
                data-idx={idx}
                role="option"
                aria-selected={active}
                onMouseMove={() => setActiveIdx(idx)}
                onClick={() => go(entry)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${active ? "bg-[var(--a-tint)]" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--a-muted)]" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--a-ink)]">{entry.title}</span>
                  <span className="block truncate text-xs text-[var(--a-muted)]">{entry.description}</span>
                </span>
                {entry.group && <span className="shrink-0 text-xs text-[var(--a-faint)]">{entry.group}</span>}
                {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--a-faint)]" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
