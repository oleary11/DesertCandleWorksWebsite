"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  DollarSign,
  ShoppingCart,
  Calculator,
  Palette,
  Wine,
  FileText,
  Stethoscope,
  TestTube,
  LogOut,
  Users,
  Mail,
  Tag,
  Receipt,
  Video,
  Undo2,
  Send,
  Truck,
  Settings,
  Star,
  BarChart2,
  GripVertical,
  LayoutGrid,
  Check,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CardSize = "large" | "small";

type CardDef = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  defaultSize: CardSize;
};

const ALL_CARDS: CardDef[] = [
  { id: "products", href: "/admin/products", title: "Products", description: "Manage inventory, pricing, and product details", icon: Package, iconBg: "bg-blue-100", iconColor: "text-blue-600", defaultSize: "large" },
  { id: "analytics-overview", href: "/admin/analytics-overview", title: "Business Overview", description: "Revenue vs costs, profit margins, and profitability", icon: DollarSign, iconBg: "bg-green-100", iconColor: "text-green-600", defaultSize: "large" },
  { id: "orders", href: "/admin/orders", title: "Orders", description: "View and manage customer orders", icon: ShoppingCart, iconBg: "bg-purple-100", iconColor: "text-purple-600", defaultSize: "large" },
  { id: "refunds", href: "/admin/refunds", title: "Refunds", description: "Process refunds and manage returns", icon: Undo2, iconBg: "bg-rose-100", iconColor: "text-rose-600", defaultSize: "large" },
  { id: "manual-sale", href: "/admin/manual-sale", title: "Manual Sale", description: "Record in-person and cash sales", icon: FileText, iconBg: "bg-amber-100", iconColor: "text-amber-600", defaultSize: "large" },
  { id: "promotions", href: "/admin/promotions", title: "Promotions", description: "Create and manage discount codes and promotions", icon: Tag, iconBg: "bg-orange-100", iconColor: "text-orange-600", defaultSize: "large" },
  { id: "scents", href: "/admin/scents", title: "Scents", description: "Manage global scent library and availability", icon: Palette, iconBg: "bg-pink-100", iconColor: "text-pink-600", defaultSize: "large" },
  { id: "reviews", href: "/admin/reviews", title: "Google Reviews", description: "Import and manage customer reviews", icon: Star, iconBg: "bg-amber-100", iconColor: "text-amber-600", defaultSize: "large" },
  { id: "alcohol-types", href: "/admin/alcohol-types", title: "Alcohol Types", description: "Manage bottle type categories", icon: Wine, iconBg: "bg-rose-100", iconColor: "text-rose-600", defaultSize: "large" },
  { id: "calculator", href: "/admin/calculator", title: "Cost Calculator", description: "Calculate material costs and profit margins", icon: Calculator, iconBg: "bg-cyan-100", iconColor: "text-cyan-600", defaultSize: "large" },
  { id: "purchases", href: "/admin/purchases", title: "Cost of Goods", description: "Track purchases, receipts, and inventory costs", icon: Receipt, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", defaultSize: "large" },
  { id: "traffic", href: "/admin/traffic", title: "Traffic Analytics", description: "Page views, top products, peak times, and cart abandonment", icon: BarChart2, iconBg: "bg-teal-100", iconColor: "text-teal-600", defaultSize: "large" },
  { id: "users", href: "/admin/users", title: "Admin Users", description: "Manage admin accounts and permissions", icon: Users, iconBg: "bg-purple-100", iconColor: "text-purple-600", defaultSize: "large" },
  { id: "invoices", href: "/admin/invoices", title: "Order Invoices", description: "Search orders and send invoice emails", icon: Mail, iconBg: "bg-indigo-100", iconColor: "text-indigo-600", defaultSize: "large" },
  { id: "emails", href: "/admin/emails", title: "Send Emails", description: "Send custom emails and shipping notifications", icon: Send, iconBg: "bg-sky-100", iconColor: "text-sky-600", defaultSize: "large" },
  { id: "activity-logs", href: "/admin/activity-logs", title: "Activity Logs", description: "View admin actions & logins", icon: FileText, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", defaultSize: "small" },
  { id: "stripe-diagnostics", href: "/admin/diagnostics/stripe-prices", title: "Stripe Diagnostics", description: "Check Stripe price mappings", icon: Stethoscope, iconBg: "bg-violet-100", iconColor: "text-violet-600", defaultSize: "small" },
  { id: "square-diagnostics", href: "/admin/diagnostics/square-catalog", title: "Square Diagnostics", description: "Check Square catalog mappings", icon: Stethoscope, iconBg: "bg-purple-100", iconColor: "text-purple-600", defaultSize: "small" },
  { id: "test-order", href: "/admin/test-order", title: "Test Order", description: "Create test transactions", icon: TestTube, iconBg: "bg-teal-100", iconColor: "text-teal-600", defaultSize: "small" },
  { id: "tiktok-shop", href: "/admin/tiktok-shop", title: "TikTok Shop", description: "Sync products to TikTok Shop", icon: Video, iconBg: "bg-pink-100", iconColor: "text-pink-600", defaultSize: "small" },
  { id: "test-shipstation", href: "/admin/test-shipstation", title: "Test ShipStation", description: "Create test shipping orders", icon: Truck, iconBg: "bg-blue-100", iconColor: "text-blue-600", defaultSize: "small" },
  { id: "settings", href: "/admin/settings", title: "Settings", description: "Product templates & defaults", icon: Settings, iconBg: "bg-gray-100", iconColor: "text-gray-600", defaultSize: "small" },
];

const CARD_MAP = new Map(ALL_CARDS.map((c) => [c.id, c]));

type LayoutData = { large: string[]; small: string[] };

function getDefaultLayout(): LayoutData {
  return {
    large: ALL_CARDS.filter((c) => c.defaultSize === "large").map((c) => c.id),
    small: ALL_CARDS.filter((c) => c.defaultSize === "small").map((c) => c.id),
  };
}

function resolveCards(layout: LayoutData): { large: CardDef[]; small: CardDef[] } {
  const saved = new Set([...layout.large, ...layout.small]);
  const extraLarge = ALL_CARDS.filter((c) => !saved.has(c.id) && c.defaultSize === "large");
  const extraSmall = ALL_CARDS.filter((c) => !saved.has(c.id) && c.defaultSize === "small");
  return {
    large: [...layout.large.map((id) => CARD_MAP.get(id)).filter(Boolean) as CardDef[], ...extraLarge],
    small: [...layout.small.map((id) => CARD_MAP.get(id)).filter(Boolean) as CardDef[], ...extraSmall],
  };
}

/* ---------- Draggable section grid ---------- */
function CardGrid({
  cards,
  size,
  editMode,
  onReorder,
  onToggleSize,
}: {
  cards: CardDef[];
  size: CardSize;
  editMode: boolean;
  onReorder: (from: number, to: number) => void;
  onToggleSize: (id: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const isLarge = size === "large";
  const isDraggingAny = dragIdx !== null;

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx);
    setDropIdx(null);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropIdx !== idx) setDropIdx(idx);
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx;
    setDragIdx(null);
    setDropIdx(null);
    if (from !== null && from !== idx) onReorder(from, idx);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDropIdx(null);
  }

  if (cards.length === 0) {
    return (
      <div className="border-2 border-dashed border-neutral-200 rounded-xl p-8 text-center text-sm text-[var(--color-muted)]">
        No cards here — toggle cards from the other section to add them.
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isLarge ? "gap-6" : "gap-4"}`}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isDraggingThis = dragIdx === idx;
        const isDropTarget = dropIdx === idx && !isDraggingThis;

        let ringClass = "";
        if (isDraggingThis) {
          ringClass = "opacity-50 ring-2 ring-dashed ring-neutral-400";
        } else if (isDropTarget) {
          ringClass = "ring-2 ring-blue-500 shadow-lg";
        } else if (isDraggingAny) {
          ringClass = "ring-1 ring-neutral-300";
        }

        const inner = (
          <div
            className={[
              "card bg-white transition-all select-none h-full flex flex-col justify-center",
              isLarge ? "p-6" : "p-4",
              editMode ? "cursor-grab active:cursor-grabbing" : "hover:shadow-lg",
              ringClass,
            ].filter(Boolean).join(" ")}
            draggable={editMode}
            onDragStart={editMode ? (e) => handleDragStart(e, idx) : undefined}
            onDragOver={editMode ? (e) => handleDragOver(e, idx) : undefined}
            onDrop={editMode ? (e) => handleDrop(e, idx) : undefined}
            onDragEnd={editMode ? handleDragEnd : undefined}
            onDragLeave={editMode ? (e) => {
              // Only clear if leaving the card itself, not a child
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropIdx(null);
              }
            } : undefined}
          >
            <div className={`flex ${isLarge ? "items-start gap-4" : "items-center gap-3"}`}>
              <div className={`${isLarge ? "w-12 h-12" : "w-10 h-10"} rounded-lg ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`${isLarge ? "w-6 h-6" : "w-5 h-5"} ${card.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={isLarge ? "text-lg font-semibold mb-1" : "font-medium"}>{card.title}</h2>
                <p className={`text-[var(--color-muted)] line-clamp-2 ${isLarge ? "text-sm" : "text-xs"}`}>{card.description}</p>
              </div>
              {editMode && (
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0 ml-1">
                  <GripVertical className="w-4 h-4 text-neutral-400" />
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleSize(card.id); }}
                    className="w-5 h-5 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                    title={isLarge ? "Move to utilities (compact)" : "Move to main (large)"}
                  >
                    {isLarge ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        );

        return editMode ? (
          <div key={card.id} className="h-full">{inner}</div>
        ) : (
          <Link key={card.id} href={card.href} className="h-full block">{inner}</Link>
        );
      })}
    </div>
  );
}

/* ---------- Page ---------- */
export default function AdminHomePage() {
  const [layout, setLayout] = useState<LayoutData>(getDefaultLayout);
  const [preEditLayout, setPreEditLayout] = useState<LayoutData>(getDefaultLayout);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard-layout")
      .then((r) => r.json())
      .then(({ layout: saved }) => {
        if (saved && Array.isArray(saved.large) && Array.isArray(saved.small)) {
          setLayout(saved);
          setPreEditLayout(saved);
        }
      })
      .catch(() => {});
  }, []);

  const { large: largeCards, small: smallCards } = resolveCards(layout);

  function handleReorder(section: CardSize, from: number, to: number) {
    setLayout((prev) => {
      const arr = [...prev[section]];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...prev, [section]: arr };
    });
  }

  function handleToggleSize(id: string) {
    setLayout((prev) => {
      if (prev.large.includes(id)) {
        return { large: prev.large.filter((x) => x !== id), small: [...prev.small, id] };
      } else {
        return { large: [...prev.large, id], small: prev.small.filter((x) => x !== id) };
      }
    });
  }

  function startEdit() {
    setPreEditLayout(layout);
    setEditMode(true);
  }

  function cancelEdit() {
    setLayout(preEditLayout);
    setEditMode(false);
  }

  async function saveLayout() {
    setSaving(true);
    try {
      await fetch("/api/admin/dashboard-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      setPreEditLayout(layout);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-[var(--color-muted)] mt-1">
              Manage your Desert Candle Works business
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {editMode ? (
              <>
                <button className="btn" onClick={cancelEdit} disabled={saving}>
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveLayout} disabled={saving}>
                  <Check className="w-4 h-4" />
                  {saving ? "Saving…" : "Save Layout"}
                </button>
              </>
            ) : (
              <button className="btn" onClick={startEdit}>
                <LayoutGrid className="w-4 h-4" />
                Edit Layout
              </button>
            )}
          </div>
        </div>

        {editMode && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <strong>Drag</strong> cards to reorder within a section. Use the <Minimize2 className="w-3.5 h-3.5 inline mx-0.5 -mt-0.5" /> / <Maximize2 className="w-3.5 h-3.5 inline mx-0.5 -mt-0.5" /> button to move a card between sections. Click <strong>Save Layout</strong> when done.
          </div>
        )}

        {/* Main / Large cards */}
        <div className="mb-8">
          {editMode && (
            <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3">
              Main — large cards
            </p>
          )}
          <CardGrid
            cards={largeCards}
            size="large"
            editMode={editMode}
            onReorder={(from, to) => handleReorder("large", from, to)}
            onToggleSize={handleToggleSize}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--color-line)] mb-8">
          {!editMode && (
            <h2 className="text-xl font-semibold mt-6 mb-4">Utilities &amp; Tools</h2>
          )}
          {editMode && (
            <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mt-6 mb-3">
              Utilities — compact cards
            </p>
          )}
        </div>

        {/* Small cards */}
        <div className="mb-8">
          <CardGrid
            cards={smallCards}
            size="small"
            editMode={editMode}
            onReorder={(from, to) => handleReorder("small", from, to)}
            onToggleSize={handleToggleSize}
          />
        </div>

        {/* Logout */}
        <div className="border-t border-[var(--color-line)] pt-6">
          <form action="/api/admin/logout" method="post">
            <button className="btn btn-ghost inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
