import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PageHeader from "./_components/PageHeader";
import { NAV_GROUPS } from "./_components/nav";

const MAIN_GROUPS = NAV_GROUPS.filter((g) => g.id !== "system");
const SYSTEM_GROUP = NAV_GROUPS.find((g) => g.id === "system");

export default function AdminHomePage() {
  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Dashboard" description="Everything for running Desert Candle Works, in one place." />

      <div className="space-y-10">
        {MAIN_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="mb-3 text-lg font-semibold tracking-tight text-[var(--a-ink)]">
              {group.label}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="a-card group flex h-full items-center gap-4 p-4 transition-[border-color,box-shadow] hover:border-[var(--a-line-strong)] hover:shadow-[var(--a-shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)]"
                    >
                      <span className="a-icon-tile">
                        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[var(--a-ink)]">{item.title}</span>
                        <span className="mt-0.5 block text-sm text-[var(--a-muted)]">{item.description}</span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--a-faint)] transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {SYSTEM_GROUP && (
          <section aria-labelledby="group-system" className="border-t border-[var(--a-line)] pt-8">
            <h2 id="group-system" className="mb-3 text-lg font-semibold tracking-tight text-[var(--a-ink)]">
              {SYSTEM_GROUP.label}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {SYSTEM_GROUP.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.description}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--a-line)] bg-[var(--a-surface)] px-3 text-sm text-[var(--a-ink)] transition-colors hover:border-[var(--a-line-strong)] hover:bg-[var(--a-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)]"
                    >
                      <Icon className="h-4 w-4 text-[var(--a-muted)]" strokeWidth={1.75} aria-hidden />
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
