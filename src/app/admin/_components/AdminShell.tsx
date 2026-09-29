"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut, Menu, Search, X } from "lucide-react";
import { DASHBOARD_ITEM, NAV_GROUPS, activeNavItem, type NavItem } from "./nav";
import CommandPalette from "./CommandPalette";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)]",
        active
          ? "bg-[var(--a-sidebar-active)] font-medium text-white before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-[var(--a-accent)]"
          : "text-[var(--a-sidebar-ink)]/85 hover:bg-[var(--a-sidebar-hover)] hover:text-white",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  const active = activeNavItem(pathname);
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        className="flex items-center gap-3 px-5 pb-4 pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)]"
      >
        <Image src="/images/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full ring-1 ring-white/15" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-white">Desert Candle Works</span>
          <span className="block text-xs text-[var(--a-sidebar-muted)]">Admin</span>
        </span>
      </Link>

      <nav aria-label="Admin" className="a-scroll flex-1 overflow-y-auto px-3 pb-4">
        <NavLink item={DASHBOARD_ITEM} active={active?.href === DASHBOARD_ITEM.href} />
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mt-5">
            <p className="a-section-label mb-1.5 px-3 text-[var(--a-sidebar-muted)]">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={active?.href === item.href} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--a-sidebar-line)] px-3 py-3">
        <form action="/api/admin/logout" method="post">
          <button className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--a-sidebar-ink)]/85 transition-colors hover:bg-[var(--a-sidebar-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)]">
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // The login page renders on its own, without navigation.
  if (pathname.startsWith("/admin/login")) {
    return <div className="admin min-h-dvh">{children}</div>;
  }

  return (
    <div className="admin min-h-dvh">
      <div className="a-ui">
        <a
          href="#admin-content"
          className="sr-only z-[70] rounded-lg bg-[var(--a-ink)] px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
      </div>
      <aside className="a-ui fixed inset-y-0 left-0 z-40 hidden w-64 bg-[var(--a-sidebar)] lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {drawerOpen && (
        <div className="a-ui fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="a-fade-enter absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="a-drawer-enter relative h-full w-72 max-w-[85vw] bg-[var(--a-sidebar)] shadow-2xl">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--a-sidebar-muted)] hover:bg-[var(--a-sidebar-hover)] hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarContent pathname={pathname} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="a-ui sticky top-0 z-30 border-b border-[var(--a-line)] bg-[var(--a-canvas)]/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="-ml-1 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--a-ink)] hover:bg-black/5 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-[var(--a-line)] bg-[var(--a-surface)] px-3 text-left text-sm text-[var(--a-faint)] transition-colors hover:border-[var(--a-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)] sm:max-w-md"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">Jump to a page…</span>
              <span className="a-kbd hidden sm:inline-flex">Ctrl K</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto hidden items-center gap-1.5 rounded-md text-sm font-medium text-[var(--a-muted)] hover:text-[var(--a-ink)] sm:inline-flex"
            >
              View storefront
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </header>

        <div id="admin-content" tabIndex={-1} className="focus:outline-none">{children}</div>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
