"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Package,
  DollarSign,
  ShoppingCart,
  Calculator,
  Palette,
  Wine,
  FileText,
  RefreshCw,
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
  Save
} from "lucide-react";

const DEFAULT_DESCRIPTION_TEMPLATE = "Hand-poured candle in an upcycled {{BOTTLE_NAME}} bottle.\n\ncoco apricot creme™ candle wax\n\nApprox. - {{WAX_OZ}} oz wax";

export default function AdminHomePage() {
  const [descriptionTemplate, setDescriptionTemplate] = useState(DEFAULT_DESCRIPTION_TEMPLATE);
  const [originalTemplate, setOriginalTemplate] = useState(DEFAULT_DESCRIPTION_TEMPLATE);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load the current template on mount
  useEffect(() => {
    async function loadTemplate() {
      try {
        const res = await fetch("/api/admin/calculator-settings");
        if (res.ok) {
          const data = await res.json();
          const template = data.defaultProductDescription || DEFAULT_DESCRIPTION_TEMPLATE;
          setDescriptionTemplate(template);
          setOriginalTemplate(template);
        }
      } catch (err) {
        console.error("Failed to load description template:", err);
      }
    }
    loadTemplate();
  }, []);

  async function saveDescriptionTemplate() {
    setSavingTemplate(true);
    setTemplateMessage(null);
    try {
      // First get current settings
      const getRes = await fetch("/api/admin/calculator-settings");
      const currentSettings = getRes.ok ? await getRes.json() : {};

      // Update with new template
      const res = await fetch("/api/admin/calculator-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentSettings,
          defaultProductDescription: descriptionTemplate,
        }),
      });

      if (res.ok) {
        setOriginalTemplate(descriptionTemplate);
        setTemplateMessage({ type: "success", text: "Description template saved!" });
      } else {
        setTemplateMessage({ type: "error", text: "Failed to save template" });
      }
    } catch (err) {
      console.error("Failed to save description template:", err);
      setTemplateMessage({ type: "error", text: "Failed to save template" });
    } finally {
      setSavingTemplate(false);
      setTimeout(() => setTemplateMessage(null), 3000);
    }
  }

  const hasTemplateChanges = descriptionTemplate !== originalTemplate;
  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Manage your Desert Candle Works business
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Products */}
          <Link href="/admin/products" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Products</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Manage inventory, pricing, and product details
                </p>
              </div>
            </div>
          </Link>

          {/* Analytics Overview */}
          <Link href="/admin/analytics-overview" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Business Overview</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Revenue vs costs, profit margins, and profitability
                </p>
              </div>
            </div>
          </Link>

          {/* Orders */}
          <Link href="/admin/orders" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Orders</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  View and manage customer orders
                </p>
              </div>
            </div>
          </Link>

          {/* Refunds */}
          <Link href="/admin/refunds" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Undo2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Refunds</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Process refunds and manage returns
                </p>
              </div>
            </div>
          </Link>

          {/* Manual Sale */}
          <Link href="/admin/manual-sale" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Manual Sale</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Record in-person and cash sales
                </p>
              </div>
            </div>
          </Link>

          {/* Promotions */}
          <Link href="/admin/promotions" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Tag className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Promotions</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Create and manage discount codes and promotions
                </p>
              </div>
            </div>
          </Link>

          {/* Scents */}
          <Link href="/admin/scents" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                <Palette className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Scents</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Manage global scent library and availability
                </p>
              </div>
            </div>
          </Link>

          {/* Alcohol Types */}
          <Link href="/admin/alcohol-types" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Wine className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Alcohol Types</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Manage bottle type categories
                </p>
              </div>
            </div>
          </Link>

          {/* Calculator */}
          <Link href="/admin/calculator" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Cost Calculator</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Calculate material costs and profit margins
                </p>
              </div>
            </div>
          </Link>

          {/* Purchases / Cost of Goods */}
          <Link href="/admin/purchases" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Cost of Goods</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Track purchases, receipts, and inventory costs
                </p>
              </div>
            </div>
          </Link>

          {/* Admin Users */}
          <Link href="/admin/users" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Admin Users</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Manage admin accounts and permissions
                </p>
              </div>
            </div>
          </Link>

          {/* Order Invoices */}
          <Link href="/admin/invoices" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Order Invoices</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Search orders and send invoice emails
                </p>
              </div>
            </div>
          </Link>

          {/* Email Management */}
          <Link href="/admin/emails" className="card p-6 bg-white hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Send className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Send Emails</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Send custom emails and shipping notifications
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Utilities Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Utilities & Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Activity Logs */}
            <Link href="/admin/activity-logs" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-medium">Activity Logs</h3>
                  <p className="text-xs text-[var(--color-muted)]">View admin actions & logins</p>
                </div>
              </div>
            </Link>

            {/* Stripe Sync */}
            <Link href="/admin/stripe-sync" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-medium">Stripe Sync</h3>
                  <p className="text-xs text-[var(--color-muted)]">Backfill missing orders</p>
                </div>
              </div>
            </Link>

            {/* Stripe Diagnostics */}
            <Link href="/admin/diagnostics/stripe-prices" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-medium">Stripe Diagnostics</h3>
                  <p className="text-xs text-[var(--color-muted)]">Check price mappings</p>
                </div>
              </div>
            </Link>

            {/* Square Diagnostics */}
            <Link href="/admin/diagnostics/square-catalog" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium">Square Diagnostics</h3>
                  <p className="text-xs text-[var(--color-muted)]">Check catalog mappings</p>
                </div>
              </div>
            </Link>

            {/* Test Order */}
            <Link href="/admin/test-order" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <TestTube className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-medium">Test Order</h3>
                  <p className="text-xs text-[var(--color-muted)]">Create test transactions</p>
                </div>
              </div>
            </Link>

            {/* TikTok Shop */}
            <Link href="/admin/tiktok-shop" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-medium">TikTok Shop</h3>
                  <p className="text-xs text-[var(--color-muted)]">Sync products to TikTok Shop</p>
                </div>
              </div>
            </Link>

            {/* ShipStation Test */}
            <Link href="/admin/test-shipstation" className="card p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">Test ShipStation</h3>
                  <p className="text-xs text-[var(--color-muted)]">Create test shipping orders</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Settings Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </h2>

          {/* Default Product Description Template */}
          <div className="card p-6 bg-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium text-lg">Default Product Description</h3>
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  Template used when auto-generating product descriptions. Use placeholders:
                </p>
                <ul className="text-xs text-[var(--color-muted)] mt-2 space-y-1">
                  <li><code className="bg-neutral-100 px-1 rounded">{"{{BOTTLE_NAME}}"}</code> - Product name without &quot;Candle&quot;</li>
                  <li><code className="bg-neutral-100 px-1 rounded">{"{{WAX_OZ}}"}</code> - Calculated wax ounces from container</li>
                </ul>
              </div>
              {templateMessage && (
                <span className={`text-sm px-3 py-1 rounded ${templateMessage.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {templateMessage.text}
                </span>
              )}
            </div>
            <textarea
              className="w-full p-3 border border-[var(--color-line)] rounded-lg font-mono text-sm resize-y min-h-[120px]"
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              placeholder="Enter description template..."
            />
            <div className="flex items-center justify-between mt-4">
              <button
                className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                onClick={() => setDescriptionTemplate(DEFAULT_DESCRIPTION_TEMPLATE)}
              >
                Reset to default
              </button>
              <button
                className="btn bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50"
                onClick={saveDescriptionTemplate}
                disabled={!hasTemplateChanges || savingTemplate}
              >
                <Save className="w-4 h-4" />
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
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
