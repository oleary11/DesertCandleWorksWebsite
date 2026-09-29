import {
  BarChart2,
  Boxes,
  Calculator,
  DollarSign,
  FileText,
  LayoutDashboard,
  Mail,
  Megaphone,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Send,
  Settings,
  ShoppingCart,
  Star,
  Stethoscope,
  Tag,
  TestTube,
  Truck,
  Undo2,
  Users,
  Video,
  Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Extra route prefixes that should mark this item active (sub-pages reached from inside it). */
  also?: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const DASHBOARD_ITEM: NavItem = {
  href: "/admin",
  title: "Dashboard",
  description: "Admin home",
  icon: LayoutDashboard,
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "sell",
    label: "Sell",
    items: [
      { href: "/admin/orders", title: "Orders", description: "View and manage customer orders", icon: ShoppingCart },
      { href: "/admin/manual-sale", title: "Manual Sale", description: "Record in-person and cash sales", icon: FileText },
      { href: "/admin/refunds", title: "Refunds", description: "Process refunds and manage returns", icon: Undo2, also: ["/admin/refunds-analytics"] },
      { href: "/admin/invoices", title: "Order Invoices", description: "Search orders and send invoice emails", icon: Mail },
      { href: "/admin/promotions", title: "Promotions", description: "Discount codes and promotions", icon: Tag },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      { href: "/admin/products", title: "Products", description: "Inventory, pricing and product details", icon: Package, also: ["/admin/stripe-product-sync"] },
      { href: "/admin/scents", title: "Scents", description: "Global scent library and availability", icon: Palette },
      { href: "/admin/alcohol-types", title: "Alcohol Types", description: "Bottle type categories", icon: Wine },
      { href: "/admin/inventory", title: "Bottle Inventory", description: "Raw bottle stock by cutting and polishing stage", icon: Boxes },
      { href: "/admin/reviews", title: "Google Reviews", description: "Import and manage customer reviews", icon: Star },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      { href: "/admin/social", title: "Social Media", description: "Generate, review and schedule posts", icon: Megaphone },
      { href: "/admin/emails", title: "Send Emails", description: "Custom emails and shipping notifications", icon: Send },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/admin/analytics-overview", title: "Business Overview", description: "Revenue, costs and profit margins", icon: DollarSign, also: ["/admin/analytics"] },
      { href: "/admin/traffic", title: "Traffic", description: "Page views, peak times and cart abandonment", icon: BarChart2 },
      { href: "/admin/purchases", title: "Cost of Goods", description: "Purchases, receipts and inventory costs", icon: Receipt },
      { href: "/admin/calculator", title: "Cost Calculator", description: "Material costs and profit margins", icon: Calculator },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/settings", title: "Settings", description: "Product templates and defaults", icon: Settings },
      { href: "/admin/users", title: "Admin Users", description: "Admin accounts and permissions", icon: Users },
      { href: "/admin/activity-logs", title: "Activity Logs", description: "Admin actions and logins", icon: ScrollText },
      { href: "/admin/diagnostics/stripe-prices", title: "Stripe Diagnostics", description: "Check Stripe price mappings", icon: Stethoscope },
      { href: "/admin/diagnostics/square-catalog", title: "Square Diagnostics", description: "Check Square catalog mappings", icon: Stethoscope },
      { href: "/admin/tiktok-shop", title: "TikTok Shop", description: "Sync products to TikTok Shop", icon: Video },
      { href: "/admin/test-order", title: "Test Order", description: "Create test transactions", icon: TestTube },
      { href: "/admin/test-shipstation", title: "Test ShipStation", description: "Create test shipping orders", icon: Truck },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [DASHBOARD_ITEM, ...NAV_GROUPS.flatMap((g) => g.items)];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** The nav item for the current route: the longest matching href (or `also` prefix) wins. */
export function activeNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  let bestLen = -1;
  for (const item of ALL_NAV_ITEMS) {
    for (const prefix of [item.href, ...(item.also ?? [])]) {
      if (prefix === "/admin" ? pathname === "/admin" : matches(pathname, prefix)) {
        if (prefix.length > bestLen) {
          best = item;
          bestLen = prefix.length;
        }
      }
    }
  }
  return best;
}
