// Shared MCP tool definitions + handlers, used by both /api/mcp (query-token
// transport) and /api/mcp/[token] (path-token transport) so the two stay in sync.
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getProductBySlug, upsertProduct, incrStock, incrVariantStock } from "@/lib/productsStore";
import {
  getAllOrders,
  getOrderById,
  createOrder,
  completeOrder,
  generateOrderId,
  updateOrderShipping,
  listAllUsers,
} from "@/lib/userStore";
import { getAllScents } from "@/lib/scents";
import { listPromotions, getPromotionById, updatePromotion } from "@/lib/promotionsStore";
import {
  getAllReviews,
  upsertReview,
  toggleReviewVisibility,
  generateReviewId,
  generateInitials,
} from "@/lib/reviewsStore";
import { getAdminLogs } from "@/lib/adminLogs";
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  calculateItemAllocations,
  getVendors,
  type PurchaseItem,
} from "@/lib/purchasesStore";
import { listRefunds } from "@/lib/refundStore";
import { sendShippingConfirmationEmail, sendDeliveryConfirmationEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Analytics helpers (shared by get_analytics, get_combo_analytics, get_tax_summary, get_profit_loss)
// ---------------------------------------------------------------------------

type AnalyticsOrder = {
  id: string; status: string; totalCents: number; createdAt: string; completedAt?: string;
  items: Array<{ productSlug: string; productName: string; quantity: number; priceCents: number; variantId?: string }>;
  shippingCents?: number; taxCents?: number; productSubtotalCents?: number; paymentMethod?: string;
};

function _isMSale(id: string) { return id.startsWith("MS") || id.toLowerCase().startsWith("manual"); }
function _isSQOrder(id: string) { return id.startsWith("SQ") || id.startsWith("sq_") || /^[A-Z0-9]{22}$/.test(id); }
function _paymentFee(id: string, totalCents: number) {
  return _isMSale(id) ? 0 : _isSQOrder(id) ? Math.round(totalCents * 0.026) + 15 : Math.round(totalCents * 0.029) + 30;
}

function _extractScentId(variantId: string): string | null {
  let r = variantId;
  const sz = r.match(/^(?:size-)?[0-9]+[a-z]*-/);
  if (sz) r = r.substring(sz[0].length);
  for (const wt of ["standard-wick", "wood-wick", "wavy-wood-wick", "wood", "standard", "cdn16", "cdn"]) {
    if (r.startsWith(wt + "-")) return r.substring(wt.length + 1) || null;
  }
  return r.match(/^[a-z-]+-(.+)$/)?.[1] ?? null;
}

function _resolveScentName(scentId: string, map: Map<string, string>): string {
  let n = map.get(scentId); if (n) return n;
  const sc = scentId.match(/^(?:size-)?[0-9]+[a-z]*-(.+)$/)?.[1];
  if (sc) { n = map.get(sc); if (n) return n; const inn = sc.match(/^(\d+)/); if (inn) { n = map.get(inn[1]!); if (n) return n; } }
  const nm = scentId.match(/^(\d+)/); if (nm) { n = map.get(nm[1]!); if (n) return n; }
  const base = sc ?? scentId;
  return base.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function _loadAnalytics(dateFrom?: string | null, dateTo?: string | null) {
  const [ordersRaw, products, refundsRaw, scents] = await Promise.all([
    getAllOrders(), listResolvedProducts(), listRefunds(), getAllScents(),
  ]);
  const refundMap = new Map<string, number>();
  for (const r of refundsRaw as Array<{ orderId: string; amountCents: number; status: string }>) {
    if (r.status === "completed") refundMap.set(r.orderId, (refundMap.get(r.orderId) ?? 0) + r.amountCents);
  }
  let orders = (ordersRaw as AnalyticsOrder[]).filter(
    (o) => o.status === "completed" && !o.id.includes("@admin.local") && (refundMap.get(o.id) ?? 0) < o.totalCents
  );
  if (dateFrom && dateTo) {
    const start = new Date(dateFrom + "T00:00:00.000Z"), end = new Date(dateTo + "T23:59:59.999Z");
    orders = orders.filter((o) => { const d = new Date(o.completedAt || o.createdAt); return d >= start && d <= end; });
  }
  return {
    orders,
    productMap: new Map(products.map((p) => [p.slug, p])),
    scentMap: new Map(scents.map((s) => [s.id, s.name])),
    refundMap,
  };
}

function _filterPurchasesByDate<T extends { purchaseDate: string }>(purchases: T[], dateFrom?: string | null, dateTo?: string | null): T[] {
  if (!dateFrom || !dateTo) return purchases;
  const start = new Date(dateFrom), end = new Date(dateTo);
  return purchases.filter((p) => { const d = new Date(p.purchaseDate); return d >= start && d <= end; });
}

// ---------------------------------------------------------------------------
// MCP tool definitions (JSON Schema for tools/list)
// ---------------------------------------------------------------------------

export const MCP_TOOLS = [
  {
    name: "list_products",
    description: "List all Desert Candle Works products with stock levels, prices, and variant info.",
    inputSchema: { type: "object", properties: { includeHidden: { type: "boolean", description: "Include hidden products (default: false)" } } },
  },
  {
    name: "get_product",
    description: "Get full details for a single product by its slug.",
    inputSchema: { type: "object", properties: { slug: { type: "string", description: "Product slug, e.g. smoked-amber-candle" } }, required: ["slug"] },
  },
  {
    name: "update_stock",
    description: "Set the stock quantity for a product.",
    inputSchema: { type: "object", properties: { slug: { type: "string" }, stock: { type: "number", description: "New stock quantity (≥ 0)" } }, required: ["slug", "stock"] },
  },
  {
    name: "get_inventory_summary",
    description: "Inventory report: total products, out-of-stock, low-stock (< 3), and which products need restocking.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_orders",
    description: "List orders with optional filters. Returns customer, total, items, and status.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max orders to return (default: 20, max: 100)" },
        status: { type: "string", enum: ["pending", "completed", "cancelled"] },
        dateFrom: { type: "string", description: "ISO date string — on or after" },
        dateTo: { type: "string", description: "ISO date string — on or before" },
        paymentMethod: { type: "string", description: "Filter by payment method (cash, card, stripe, square, etc.)" },
      },
    },
  },
  {
    name: "get_order",
    description: "Get full details for a single order by its ID.",
    inputSchema: { type: "object", properties: { orderId: { type: "string", description: "The order ID, e.g. MS00012" } }, required: ["orderId"] },
  },
  {
    name: "mark_order_shipped",
    description: "Mark an order as shipped or delivered, add a tracking number, and send the customer a confirmation email.",
    inputSchema: {
      type: "object",
      properties: { orderId: { type: "string" }, trackingNumber: { type: "string" }, shippingStatus: { type: "string", enum: ["shipped", "delivered"] } },
      required: ["orderId", "trackingNumber", "shippingStatus"],
    },
  },
  {
    name: "record_manual_sale",
    description: "Record a manual (in-person) sale. Creates a completed order and optionally decrements stock.",
    inputSchema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object", properties: { productSlug: { type: "string" }, productName: { type: "string" }, quantity: { type: "number" }, priceCents: { type: "number" }, variantId: { type: "string" } }, required: ["productSlug", "productName", "quantity", "priceCents"] } },
        paymentMethod: { type: "string", enum: ["cash", "card", "other"] },
        decrementStock: { type: "boolean" },
        discountCents: { type: "number" },
        customerEmail: { type: "string" },
        notes: { type: "string" },
      },
      required: ["items", "paymentMethod"],
    },
  },
  {
    name: "get_revenue_summary",
    description: "Total revenue, order count, and average order value for a date range, broken down by payment method.",
    inputSchema: { type: "object", properties: { dateFrom: { type: "string" }, dateTo: { type: "string" } } },
  },
  { name: "list_customers", description: "List all customer accounts (email, name, ID).", inputSchema: { type: "object", properties: {} } },
  { name: "list_scents", description: "List all available candle scents with their IDs and names.", inputSchema: { type: "object", properties: {} } },
  {
    name: "get_scent_stock",
    description: "Get stock levels for a specific scent across all products and variants. Returns per-product and per-variant breakdown plus total units in stock.",
    inputSchema: { type: "object", properties: { scent: { type: "string", description: "Scent ID (e.g. smoked-amber) or scent name (e.g. Smoked Amber)" } }, required: ["scent"] },
  },
  {
    name: "list_promotions",
    description: "List all promo codes and discount promotions, including status and redemption counts.",
    inputSchema: { type: "object", properties: { activeOnly: { type: "boolean" } } },
  },
  {
    name: "toggle_promotion",
    description: "Enable or disable a promotion by its ID.",
    inputSchema: { type: "object", properties: { promotionId: { type: "string" }, active: { type: "boolean" } }, required: ["promotionId", "active"] },
  },
  {
    name: "list_reviews",
    description: "List all customer reviews shown on the website.",
    inputSchema: { type: "object", properties: { visibleOnly: { type: "boolean" } } },
  },
  {
    name: "add_review",
    description: "Add a new customer review to the website.",
    inputSchema: { type: "object", properties: { reviewerName: { type: "string" }, rating: { type: "number" }, text: { type: "string" }, date: { type: "string" }, visible: { type: "boolean" } }, required: ["reviewerName", "rating", "text", "date"] },
  },
  {
    name: "toggle_review_visibility",
    description: "Show or hide a review on the website.",
    inputSchema: { type: "object", properties: { reviewId: { type: "string" } }, required: ["reviewId"] },
  },
  {
    name: "list_supply_purchases",
    description: "List supply purchases (raw materials, bottles, wicks, etc.) recorded in the admin.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_purchase",
    description: "Get full details for a single supply purchase by its ID, including per-item cost allocation (shipping/tax spread proportionally across items).",
    inputSchema: { type: "object", properties: { purchaseId: { type: "string" } }, required: ["purchaseId"] },
  },
  {
    name: "record_purchase",
    description: "Record a new supply purchase (wax, wicks, bottles, labels, packaging, etc.) for cost tracking and tax deductions.",
    inputSchema: {
      type: "object",
      properties: {
        vendorName: { type: "string" },
        purchaseDate: { type: "string", description: "YYYY-MM-DD" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "number" },
              unitCostCents: { type: "number" },
              category: { type: "string", description: "e.g. wax, wicks, bottles, labels, packaging, shipping-supplies, other" },
              notes: { type: "string" },
            },
            required: ["name", "quantity", "unitCostCents", "category"],
          },
        },
        shippingCents: { type: "number", description: "Shipping cost for the order (default 0)" },
        taxCents: { type: "number", description: "Sales tax paid on the order (default 0)" },
        receiptImageUrl: { type: "string" },
        notes: { type: "string" },
      },
      required: ["vendorName", "purchaseDate", "items"],
    },
  },
  {
    name: "update_purchase",
    description: "Update an existing supply purchase's vendor, date, items, shipping, tax, or notes.",
    inputSchema: {
      type: "object",
      properties: {
        purchaseId: { type: "string" },
        vendorName: { type: "string" },
        purchaseDate: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "number" },
              unitCostCents: { type: "number" },
              category: { type: "string" },
              notes: { type: "string" },
            },
            required: ["name", "quantity", "unitCostCents", "category"],
          },
        },
        shippingCents: { type: "number" },
        taxCents: { type: "number" },
        notes: { type: "string" },
      },
      required: ["purchaseId"],
    },
  },
  {
    name: "delete_purchase",
    description: "Delete a supply purchase record by its ID.",
    inputSchema: { type: "object", properties: { purchaseId: { type: "string" } }, required: ["purchaseId"] },
  },
  {
    name: "list_purchase_vendors",
    description: "List all distinct supply vendors that purchases have been recorded from.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_purchase_analytics",
    description: "Supply purchase spending report: totals, breakdown by category and vendor. Use this for COGS and expense tracking.",
    inputSchema: { type: "object", properties: { dateFrom: { type: "string", description: "YYYY-MM-DD" }, dateTo: { type: "string", description: "YYYY-MM-DD" } } },
  },
  {
    name: "get_activity_logs",
    description: "Get recent admin activity logs — what actions have been taken and when.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_analytics",
    description: "Full store analytics: revenue (gross, net, tax, shipping, payment fees), units sold, top products, sales by alcohol type (uses actual product data — not guessed from name), scent, wick type, and sales channel. More accurate than get_revenue_summary for business questions.",
    inputSchema: { type: "object", properties: { dateFrom: { type: "string", description: "Start date YYYY-MM-DD (optional)" }, dateTo: { type: "string", description: "End date YYYY-MM-DD (optional)" } } },
  },
  {
    name: "get_combo_analytics",
    description: "Rank every alcohol-type × scent combination by units sold and revenue. Use this to find the most or least popular combos.",
    inputSchema: { type: "object", properties: { dateFrom: { type: "string" }, dateTo: { type: "string" }, limit: { type: "number", description: "Top N combos to return (default: 20)" } } },
  },
  {
    name: "get_profit_loss",
    description: "Real profit & loss for a period: gross revenue, payment processing fees, supply/COGS purchases, and net profit with margin — both store-wide and product-only views. This is your actual earnings, unlike get_revenue_summary which only shows gross sales before costs.",
    inputSchema: { type: "object", properties: { dateFrom: { type: "string", description: "YYYY-MM-DD" }, dateTo: { type: "string", description: "YYYY-MM-DD" } } },
  },
  {
    name: "get_tax_summary",
    description: "Estimated business tax owed for a period: Arizona TPT (sales tax) to remit, and a federal estimated-tax planning figure (net profit after fees and COGS × a set-aside rate). Planning estimate only, not tax advice.",
    inputSchema: {
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "YYYY-MM-DD" },
        dateTo: { type: "string", description: "YYYY-MM-DD" },
        federalRate: { type: "number", description: "Set-aside rate applied to net profit for federal + self-employment tax planning (default 0.25)" },
      },
    },
  },
  {
    name: "list_refunds",
    description: "List refunds issued to customers, with reason, amount, and status.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["pending", "processing", "completed", "failed"] }, limit: { type: "number" } } },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type Args = Record<string, unknown>;
type ToolResult = { content: Array<{ type: "text"; text: string }> };
const t = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const MCP_HANDLERS: Record<string, (args: Args) => Promise<ToolResult>> = {
  async list_products({ includeHidden }) {
    const products = await listResolvedProducts();
    const filtered = includeHidden ? products : products.filter((p) => p.visibleOnWebsite !== false);
    const lines = filtered.map((p) => `• ${p.name} (${p.slug})\n  Price: $${p.price.toFixed(2)} | Stock: ${p.stock} | SKU: ${p.sku}${p.variantConfig ? " | Has variants" : ""}${p.visibleOnWebsite === false ? " | HIDDEN" : ""}`);
    return t(`${filtered.length} products:\n\n${lines.join("\n")}`);
  },
  async get_product({ slug }) {
    const product = await getProductBySlug(slug as string);
    return t(product ? JSON.stringify(product, null, 2) : `No product found with slug: ${slug}`);
  },
  async update_stock({ slug, stock }) {
    const product = await getProductBySlug(slug as string);
    if (!product) return t(`Error: No product found with slug: ${slug}`);
    const old = product.stock;
    await upsertProduct({ ...product, stock: stock as number });
    return t(`Updated stock for "${product.name}" (${slug}): ${old} → ${stock}`);
  },
  async get_inventory_summary() {
    const products = await listResolvedProducts();
    const visible = products.filter((p) => p.visibleOnWebsite !== false);
    const out = visible.filter((p) => p.stock === 0);
    const low = visible.filter((p) => p.stock > 0 && p.stock < 3);
    const ok = visible.filter((p) => p.stock >= 3);
    const lines = [`Inventory Summary (${visible.length} products)`, `  Healthy stock (≥3): ${ok.length}`, `  Low stock (1-2):    ${low.length}`, `  Out of stock:       ${out.length}`, ""];
    if (low.length) { lines.push("Low stock:"); low.forEach((p) => lines.push(`  • ${p.name} — ${p.stock} left`)); lines.push(""); }
    if (out.length) { lines.push("Out of stock:"); out.forEach((p) => lines.push(`  • ${p.name}`)); }
    return t(lines.join("\n"));
  },
  async list_orders({ limit, status, dateFrom, dateTo, paymentMethod }) {
    const max = Math.min(Number(limit ?? 20), 100);
    const from = dateFrom ? new Date(dateFrom as string) : null;
    const to = dateTo ? new Date(dateTo as string) : null;
    let orders = await getAllOrders();
    orders = orders.filter((o) => !o.email.includes("@admin.local"));
    if (status) orders = orders.filter((o) => o.status === status);
    if (paymentMethod) orders = orders.filter((o) => o.paymentMethod?.toLowerCase().includes((paymentMethod as string).toLowerCase()));
    if (from) orders = orders.filter((o) => new Date(o.createdAt) >= from);
    if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); orders = orders.filter((o) => new Date(o.createdAt) <= end); }
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    orders = orders.slice(0, max);
    if (!orders.length) return t("No orders found matching the given filters.");
    const lines = orders.map((o) => `[${o.id}] ${new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${o.email} — $${(o.totalCents / 100).toFixed(2)} (${o.paymentMethod ?? "?"}) — ${o.status}${o.trackingNumber ? ` | tracking: ${o.trackingNumber}` : ""}\n  Items: ${o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}`);
    return t(`${orders.length} orders:\n\n${lines.join("\n")}`);
  },
  async get_order({ orderId }) {
    const order = await getOrderById(orderId as string);
    return t(order ? JSON.stringify(order, null, 2) : `No order found with ID: ${orderId}`);
  },
  async mark_order_shipped({ orderId, trackingNumber, shippingStatus }) {
    const order = await getOrderById(orderId as string);
    if (!order) return t(`Error: No order found with ID: ${orderId}`);
    await updateOrderShipping(orderId as string, trackingNumber as string, shippingStatus as "shipped" | "delivered");
    let emailNote = "";
    try {
      if (shippingStatus === "shipped") { await sendShippingConfirmationEmail(orderId as string, trackingNumber as string); emailNote = " Shipping confirmation email sent."; }
      else { await sendDeliveryConfirmationEmail(orderId as string, trackingNumber as string); emailNote = " Delivery confirmation email sent."; }
    } catch { emailNote = " (Email failed — order still updated.)"; }
    return t(`Order ${orderId} marked as ${shippingStatus}. Tracking: ${trackingNumber}.${emailNote}`);
  },
  async record_manual_sale({ items, paymentMethod, decrementStock, discountCents, customerEmail, notes }) {
    type SI = { productSlug: string; productName: string; quantity: number; priceCents: number; variantId?: string };
    const saleItems = items as SI[];
    const shouldDecrement = decrementStock !== false;
    const discount = (discountCents as number) ?? 0;
    const email = (customerEmail as string) ?? "manual-sale@admin.local";
    const subtotal = saleItems.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    const total = Math.max(0, subtotal - discount);
    const orderId = await generateOrderId("manual");
    if (shouldDecrement) {
      for (const item of saleItems) {
        try {
          if (item.variantId) await incrVariantStock(item.productSlug, item.variantId, -item.quantity);
          else await incrStock(item.productSlug, -item.quantity);
        }
        catch (err) { return t(`Error: Failed to decrement stock for ${item.productName}: ${String(err)}`); }
      }
    }
    await createOrder(email, orderId, total, saleItems.map((i) => ({ productSlug: i.productSlug, productName: i.productName, quantity: i.quantity, priceCents: i.priceCents, variantId: i.variantId })), undefined, undefined, undefined, undefined, paymentMethod as string, notes as string | undefined);
    await completeOrder(orderId);
    return t([`Sale recorded! Order ID: ${orderId}`, `Items: ${saleItems.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}`, `Total: $${(total / 100).toFixed(2)} (${paymentMethod})`, discount > 0 ? `Discount: $${(discount / 100).toFixed(2)}` : null, notes ? `Notes: ${notes}` : null].filter(Boolean).join("\n"));
  },
  async get_revenue_summary({ dateFrom, dateTo }) {
    const from = dateFrom ? new Date(dateFrom as string) : null;
    const to = dateTo ? new Date(dateTo as string) : null;
    let orders = await getAllOrders();
    orders = orders.filter((o) => o.status === "completed" && !o.email.includes("@admin.local"));
    if (from) orders = orders.filter((o) => new Date(o.createdAt) >= from);
    if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); orders = orders.filter((o) => new Date(o.createdAt) <= end); }
    if (!orders.length) return t("No completed orders found for the given date range.");
    const total = orders.reduce((s, o) => s + o.totalCents, 0);
    const byMethod: Record<string, { count: number; totalCents: number }> = {};
    for (const o of orders) { const m = o.paymentMethod ?? "unknown"; if (!byMethod[m]) byMethod[m] = { count: 0, totalCents: 0 }; byMethod[m].count++; byMethod[m].totalCents += o.totalCents; }
    const label = from || to ? ` (${from ? from.toLocaleDateString() : "all time"} – ${to ? to.toLocaleDateString() : "now"})` : "";
    return t([`Revenue Summary${label}`, `  Orders:        ${orders.length}`, `  Total revenue: $${(total / 100).toFixed(2)}`, `  Average order: $${(total / orders.length / 100).toFixed(2)}`, "", "By payment method:", ...Object.entries(byMethod).map(([m, d]) => `  ${m.padEnd(12)} ${String(d.count).padStart(3)} orders   $${(d.totalCents / 100).toFixed(2)}`)].join("\n"));
  },
  async list_customers() {
    const users = await listAllUsers();
    if (!users.length) return t("No customer accounts found.");
    return t(`${users.length} customers:\n\n${users.map((u) => `• ${u.firstName} ${u.lastName} — ${u.email} (id: ${u.id})`).join("\n")}`);
  },
  async list_scents() {
    const scents = await getAllScents();
    if (!scents.length) return t("No scents found.");
    const lines = scents.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name)).map((s) => { const flags = [s.limited ? "limited" : null, s.seasonal ? "seasonal" : null].filter(Boolean).join(", "); return `• ${s.name} (id: ${s.id})${flags ? ` [${flags}]` : ""}`; });
    return t(`${scents.length} scents:\n\n${lines.join("\n")}`);
  },
  async get_scent_stock({ scent }) {
    const scentInput = (scent as string).trim();
    const allScents = await getAllScents();
    const match = allScents.find((s) => s.id === scentInput || s.name.toLowerCase() === scentInput.toLowerCase());
    const scentId = match?.id ?? scentInput.toLowerCase().replace(/\s+/g, "-");
    const scentName = match?.name ?? scentInput;
    const products = await listResolvedProducts();
    const results: string[] = [];
    let grandTotal = 0;
    for (const p of products) {
      if (!p.variantConfig?.variantData) continue;
      const matchingVariants = Object.entries(p.variantConfig.variantData).filter(([variantId]) => variantId === scentId || variantId.endsWith(`-${scentId}`));
      if (!matchingVariants.length) continue;
      const productTotal = matchingVariants.reduce((s, [, v]) => s + (v.stock ?? 0), 0);
      grandTotal += productTotal;
      const variantLines = matchingVariants.map(([variantId, v]) => `    • ${variantId}: ${v.stock ?? 0}`);
      results.push(`${p.name} (${p.slug}) — ${productTotal} total\n${variantLines.join("\n")}`);
    }
    if (!results.length) return t(`No variants found for scent "${scentName}" (id: ${scentId}). Use list_scents to see valid scent IDs.`);
    return t(`Stock for scent: ${scentName} (id: ${scentId})\nTotal units in stock: ${grandTotal}\n\n${results.join("\n\n")}`);
  },
  async list_promotions({ activeOnly }) {
    let promos = await listPromotions();
    if (activeOnly) promos = promos.filter((p) => p.active);
    if (!promos.length) return t("No promotions found.");
    const lines = promos.map((p) => { const d = p.type === "percentage" ? `${p.discountPercent}% off` : p.type === "fixed_amount" ? `$${((p.discountAmountCents ?? 0) / 100).toFixed(2)} off` : p.type; return `• [${p.active ? "ACTIVE" : "inactive"}] ${p.code} — ${p.name}\n  ${d} | ${p.currentRedemptions}${p.maxRedemptions ? `/${p.maxRedemptions}` : ""} uses | ${p.expiresAt ? `expires ${new Date(p.expiresAt).toLocaleDateString()}` : "no expiry"}\n  ID: ${p.id}`; });
    return t(`${promos.length} promotions:\n\n${lines.join("\n")}`);
  },
  async toggle_promotion({ promotionId, active }) {
    const promo = await getPromotionById(promotionId as string);
    if (!promo) return t(`Error: No promotion found with ID: ${promotionId}`);
    await updatePromotion(promotionId as string, { active: active as boolean });
    return t(`Promotion "${promo.code}" (${promo.name}) is now ${active ? "ACTIVE" : "INACTIVE"}.`);
  },
  async list_reviews({ visibleOnly }) {
    let reviews = await getAllReviews();
    if (visibleOnly) reviews = reviews.filter((r) => r.visible);
    if (!reviews.length) return t("No reviews found.");
    const lines = reviews.map((r) => `• [${r.visible ? "visible" : "hidden"}] ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} ${r.reviewerName} — ${r.date}\n  "${r.text.slice(0, 100)}${r.text.length > 100 ? "…" : ""}"\n  ID: ${r.id}`);
    return t(`${reviews.length} reviews:\n\n${lines.join("\n")}`);
  },
  async add_review({ reviewerName, rating, text: reviewText, date, visible }) {
    const review = { id: generateReviewId(), reviewerName: reviewerName as string, reviewerInitials: generateInitials(reviewerName as string), rating: rating as number, text: reviewText as string, date: date as string, importedAt: new Date().toISOString(), visible: visible !== false };
    await upsertReview(review);
    return t(`Review added from ${reviewerName} (${rating} stars). ID: ${review.id}. Visible: ${review.visible}.`);
  },
  async toggle_review_visibility({ reviewId }) {
    const review = await toggleReviewVisibility(reviewId as string);
    if (!review) return t(`Error: No review found with ID: ${reviewId}`);
    return t(`Review by ${review.reviewerName} is now ${review.visible ? "VISIBLE" : "HIDDEN"} on the website.`);
  },
  async list_supply_purchases({ limit }) {
    const purchases = await getAllPurchases();
    const sorted = purchases.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()).slice(0, Math.min(Number(limit ?? 20), 100));
    if (!sorted.length) return t("No supply purchases recorded.");
    const total = purchases.reduce((s, p) => s + p.totalCents, 0);
    return t([`${sorted.length} purchases (${purchases.length} total, $${(total / 100).toFixed(2)} all-time):`, "", ...sorted.map((p) => { const names = p.items.slice(0, 3).map((i) => i.name).join(", "); return `• [${p.id}] ${p.purchaseDate} — ${p.vendorName} — $${(p.totalCents / 100).toFixed(2)} (${p.items.length} items)\n  ${names}${p.items.length > 3 ? ` +${p.items.length - 3} more` : ""}`; })].join("\n"));
  },
  async get_purchase({ purchaseId }) {
    const purchase = await getPurchaseById(purchaseId as string);
    if (!purchase) return t(`No purchase found with ID: ${purchaseId}`);
    const allocatedItems = calculateItemAllocations(purchase.items, purchase.shippingCents, purchase.taxCents);
    return t(JSON.stringify({ ...purchase, items: allocatedItems }, null, 2));
  },
  async record_purchase({ vendorName, purchaseDate, items, shippingCents, taxCents, receiptImageUrl, notes }) {
    const purchase = await createPurchase(
      vendorName as string,
      purchaseDate as string,
      items as PurchaseItem[],
      (shippingCents as number) ?? 0,
      (taxCents as number) ?? 0,
      receiptImageUrl as string | undefined,
      notes as string | undefined
    );
    return t([
      `Purchase recorded! ID: ${purchase.id}`,
      `Vendor: ${purchase.vendorName} — ${purchase.purchaseDate}`,
      `Items: ${purchase.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}`,
      `Total: ${fmt(purchase.totalCents)} (subtotal ${fmt(purchase.subtotalCents)} + shipping ${fmt(purchase.shippingCents)} + tax ${fmt(purchase.taxCents)})`,
    ].join("\n"));
  },
  async update_purchase({ purchaseId, vendorName, purchaseDate, items, shippingCents, taxCents, notes }) {
    const existing = await getPurchaseById(purchaseId as string);
    if (!existing) return t(`Error: No purchase found with ID: ${purchaseId}`);
    const newItems = (items as PurchaseItem[] | undefined) ?? existing.items;
    const newShipping = (shippingCents as number | undefined) ?? existing.shippingCents;
    const newTax = (taxCents as number | undefined) ?? existing.taxCents;
    const subtotalCents = newItems.reduce((s, i) => s + i.quantity * i.unitCostCents, 0);
    const totalCents = subtotalCents + newShipping + newTax;
    const updated = await updatePurchase(purchaseId as string, {
      vendorName: (vendorName as string | undefined) ?? existing.vendorName,
      purchaseDate: (purchaseDate as string | undefined) ?? existing.purchaseDate,
      items: newItems,
      shippingCents: newShipping,
      taxCents: newTax,
      subtotalCents,
      totalCents,
      notes: (notes as string | undefined) ?? existing.notes,
    });
    if (!updated) return t(`Error: No purchase found with ID: ${purchaseId}`);
    return t(`Purchase ${purchaseId} updated.\nVendor: ${updated.vendorName} — ${updated.purchaseDate}\nTotal: ${fmt(updated.totalCents)}`);
  },
  async delete_purchase({ purchaseId }) {
    const existing = await getPurchaseById(purchaseId as string);
    if (!existing) return t(`Error: No purchase found with ID: ${purchaseId}`);
    await deletePurchase(purchaseId as string);
    return t(`Deleted purchase ${purchaseId} (${existing.vendorName}, ${existing.purchaseDate}, ${fmt(existing.totalCents)}).`);
  },
  async list_purchase_vendors() {
    const vendors = await getVendors();
    return t(vendors.length ? `${vendors.length} vendors:\n\n${vendors.map((v) => `• ${v}`).join("\n")}` : "No vendors recorded.");
  },
  async get_purchase_analytics({ dateFrom, dateTo }) {
    const purchases = _filterPurchasesByDate(await getAllPurchases(), dateFrom as string | undefined, dateTo as string | undefined);
    if (!purchases.length) return t("No supply purchases found for the given date range.");
    const byCategory = new Map<string, { cents: number; items: number }>();
    const byVendor = new Map<string, { cents: number; count: number }>();
    let totalSpent = 0, totalShipping = 0, totalTax = 0;
    for (const p of purchases) {
      totalSpent += p.totalCents; totalShipping += p.shippingCents; totalTax += p.taxCents;
      const v = byVendor.get(p.vendorName) ?? { cents: 0, count: 0 };
      v.cents += p.totalCents; v.count++; byVendor.set(p.vendorName, v);
      for (const item of calculateItemAllocations(p.items, p.shippingCents, p.taxCents)) {
        const cat = item.category || "other";
        const c = byCategory.get(cat) ?? { cents: 0, items: 0 };
        c.cents += item.fullyLoadedCostCents; c.items += item.quantity; byCategory.set(cat, c);
      }
    }
    const label = dateFrom && dateTo ? ` (${dateFrom} – ${dateTo})` : " (all time)";
    const lines = [
      `Purchase Analytics${label}`,
      `  Purchases:     ${purchases.length}`,
      `  Total spent:   ${fmt(totalSpent)}`,
      `  Shipping:      ${fmt(totalShipping)}`,
      `  Tax paid:      ${fmt(totalTax)}`,
      ``,
      `By category:`,
      ...[...byCategory.entries()].sort((a, b) => b[1].cents - a[1].cents).map(([k, v]) => `  ${k.padEnd(18)} ${fmt(v.cents)}   (${v.items} items)`),
      ``,
      `By vendor:`,
      ...[...byVendor.entries()].sort((a, b) => b[1].cents - a[1].cents).map(([k, v]) => `  ${k.padEnd(24)} ${fmt(v.cents)}   (${v.count} purchases)`),
    ];
    return t(lines.join("\n"));
  },
  async get_activity_logs({ limit }) {
    const logs = await getAdminLogs(Math.min(Number(limit ?? 30), 100));
    if (!logs.length) return t("No activity logs found.");
    return t(`${logs.length} recent actions:\n\n${logs.map((l) => `${l.success ? "✓" : "✗"} [${new Date(l.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}] ${l.action}${l.adminEmail ? ` by ${l.adminEmail}` : ""}`).join("\n")}`);
  },
  async get_analytics({ dateFrom, dateTo }) {
    const { orders, productMap, scentMap, refundMap } = await _loadAnalytics(dateFrom as string | null, dateTo as string | null);
    if (!orders.length) return t("No completed orders found for the given date range.");

    let totalRevenue = 0, totalShipping = 0, totalTax = 0, totalFees = 0, totalUnits = 0;
    const alcoholMap = new Map<string, { units: number; revenue: number }>();
    const scentSales = new Map<string, { units: number; revenue: number }>();
    const wickSales = new Map<string, { units: number; revenue: number }>();
    const channelMap = new Map<string, { orders: number; units: number; revenue: number }>();

    for (const order of orders) {
      const refunded = refundMap.get(order.id) ?? 0;
      const refundRatio = order.totalCents > 0 ? 1 - refunded / order.totalCents : 1;
      const net = order.totalCents - refunded;
      totalRevenue += net;
      totalShipping += (order.shippingCents ?? 0) * refundRatio;
      totalTax += (order.taxCents ?? 0) * refundRatio;
      const fee = _paymentFee(order.id, order.totalCents);
      totalFees += fee;
      const channel = _isMSale(order.id) ? "Manual" : _isSQOrder(order.id) ? "Square" : "Stripe";
      const ch = channelMap.get(channel) ?? { orders: 0, units: 0, revenue: 0 };
      const orderUnits = order.items.reduce((s, i) => s + i.quantity, 0);
      ch.orders++; ch.units += orderUnits; ch.revenue += net; channelMap.set(channel, ch);
      totalUnits += orderUnits;

      for (const item of order.items) {
        const product = productMap.get(item.productSlug);
        const itemRevenue = Math.round(item.priceCents * refundRatio);
        const alcoholType = (product as { alcoholType?: string } | undefined)?.alcoholType || "Other";
        const at = alcoholMap.get(alcoholType) ?? { units: 0, revenue: 0 };
        at.units += item.quantity; at.revenue += itemRevenue; alcoholMap.set(alcoholType, at);
        if (item.variantId) {
          const scentId = _extractScentId(item.variantId);
          if (scentId) {
            const scentName = _resolveScentName(scentId, scentMap);
            const ss = scentSales.get(scentName) ?? { units: 0, revenue: 0 };
            ss.units += item.quantity; ss.revenue += itemRevenue; scentSales.set(scentName, ss);
          }
          const wickName = item.variantId.includes("wood") ? "Wood Wick" : "Standard Wick";
          const ws = wickSales.get(wickName) ?? { units: 0, revenue: 0 };
          ws.units += item.quantity; ws.revenue += itemRevenue; wickSales.set(wickName, ws);
        }
      }
    }

    const label = (dateFrom && dateTo) ? ` (${dateFrom} – ${dateTo})` : " (all time)";
    const lines = [
      `Analytics Summary${label}`,
      `────────────────────────────────`,
      `Gross revenue:   ${fmt(totalRevenue)}`,
      `  Tax collected: ${fmt(Math.round(totalTax))}`,
      `  Shipping:      ${fmt(Math.round(totalShipping))}`,
      `  Payment fees:  ${fmt(totalFees)}`,
      `Net revenue:     ${fmt(totalRevenue - totalFees)}`,
      `Orders:          ${orders.length}`,
      `Units sold:      ${totalUnits}`,
      `Avg order value: ${fmt(Math.round(totalRevenue / orders.length))}`,
      ``,
      `By Alcohol Type:`,
      ...[...alcoholMap.entries()].sort((a, b) => b[1].units - a[1].units).map(([k, v]) => `  ${k.padEnd(18)} ${String(v.units).padStart(3)} units   ${fmt(v.revenue)}`),
      ``,
      `By Scent (top 10):`,
      ...[...scentSales.entries()].sort((a, b) => b[1].units - a[1].units).slice(0, 10).map(([k, v]) => `  ${k.padEnd(22)} ${String(v.units).padStart(3)} units   ${fmt(v.revenue)}`),
      ``,
      `By Wick Type:`,
      ...[...wickSales.entries()].sort((a, b) => b[1].units - a[1].units).map(([k, v]) => `  ${k.padEnd(18)} ${String(v.units).padStart(3)} units   ${fmt(v.revenue)}`),
      ``,
      `By Sales Channel:`,
      ...[...channelMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([k, v]) => `  ${k.padEnd(10)} ${String(v.orders).padStart(3)} orders  ${String(v.units).padStart(3)} units   ${fmt(v.revenue)}`),
    ];
    return t(lines.join("\n"));
  },
  async get_combo_analytics({ dateFrom, dateTo, limit }) {
    const max = Math.min(Number(limit ?? 20), 100);
    const { orders, productMap, scentMap, refundMap } = await _loadAnalytics(dateFrom as string | null, dateTo as string | null);
    if (!orders.length) return t("No completed orders found for the given date range.");

    const comboMap = new Map<string, { alcoholType: string; scent: string; units: number; revenue: number }>();

    for (const order of orders) {
      const refunded = refundMap.get(order.id) ?? 0;
      const refundRatio = order.totalCents > 0 ? 1 - refunded / order.totalCents : 1;
      for (const item of order.items) {
        if (!item.variantId) continue;
        const scentId = _extractScentId(item.variantId);
        if (!scentId) continue;
        const product = productMap.get(item.productSlug);
        const alcoholType = (product as { alcoholType?: string } | undefined)?.alcoholType || "Other";
        const scentName = _resolveScentName(scentId, scentMap);
        const key = `${alcoholType}||${scentName}`;
        const existing = comboMap.get(key) ?? { alcoholType, scent: scentName, units: 0, revenue: 0 };
        existing.units += item.quantity;
        existing.revenue += Math.round(item.priceCents * refundRatio);
        comboMap.set(key, existing);
      }
    }

    const sorted = [...comboMap.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, max);
    if (!sorted.length) return t("No variant sales data found. Orders may not have variant IDs recorded.");

    const label = (dateFrom && dateTo) ? ` (${dateFrom} – ${dateTo})` : " (all time)";
    const lines = sorted.map((c, i) => `#${String(i + 1).padStart(2)}  ${c.alcoholType} × ${c.scent}  —  ${c.units} units  ${fmt(c.revenue)}`);
    return t(`Top ${sorted.length} Alcohol Type × Scent Combos${label}:\n\n${lines.join("\n")}`);
  },
  async get_profit_loss({ dateFrom, dateTo }) {
    const { orders, refundMap } = await _loadAnalytics(dateFrom as string | null, dateTo as string | null);
    if (!orders.length) return t("No completed orders found for the given date range.");

    let grossRevenue = 0, totalProductRevenue = 0, fees = 0;
    for (const order of orders) {
      const refunded = refundMap.get(order.id) ?? 0;
      const refundRatio = order.totalCents > 0 ? 1 - refunded / order.totalCents : 1;
      grossRevenue += order.totalCents - refunded;
      totalProductRevenue += (order.productSubtotalCents ?? order.totalCents) * refundRatio;
      fees += _paymentFee(order.id, order.totalCents);
    }

    const purchases = _filterPurchasesByDate(await getAllPurchases(), dateFrom as string | undefined, dateTo as string | undefined);
    const totalCosts = purchases.reduce((s, p) => s + p.totalCents, 0);
    const purchaseShipping = purchases.reduce((s, p) => s + p.shippingCents, 0);
    const purchaseTax = purchases.reduce((s, p) => s + p.taxCents, 0);

    const netRevenue = grossRevenue - fees;
    const grossProfit = netRevenue - totalCosts;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const productCosts = totalCosts - purchaseShipping - purchaseTax;
    const productProfit = totalProductRevenue - productCosts;
    const productMargin = totalProductRevenue > 0 ? (productProfit / totalProductRevenue) * 100 : 0;

    const label = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "all time";
    const lines = [
      `Profit & Loss (${label})`,
      `────────────────────────────────`,
      `Gross revenue (incl. tax/shipping): ${fmt(Math.round(grossRevenue))}`,
      `− Payment processing fees:          ${fmt(fees)}`,
      `= Net revenue:                      ${fmt(Math.round(netRevenue))}`,
      `− Supply purchases (COGS):          ${fmt(totalCosts)}`,
      `= Gross profit:                     ${fmt(Math.round(grossProfit))}   (${grossMargin.toFixed(1)}% margin)`,
      ``,
      `Product-only view (excl. shipping & sales tax):`,
      `  Product revenue:  ${fmt(Math.round(totalProductRevenue))}`,
      `  Product costs:    ${fmt(productCosts)}`,
      `  Product profit:   ${fmt(Math.round(productProfit))}   (${productMargin.toFixed(1)}% margin)`,
    ];
    return t(lines.join("\n"));
  },
  async get_tax_summary({ dateFrom, dateTo, federalRate }) {
    const { orders, refundMap } = await _loadAnalytics(dateFrom as string | null, dateTo as string | null);
    const rate = typeof federalRate === "number" ? federalRate : 0.25;

    let productRevenue = 0, shippingRevenue = 0, taxCollected = 0, fees = 0;
    for (const order of orders) {
      const refunded = refundMap.get(order.id) ?? 0;
      const refundRatio = order.totalCents > 0 ? 1 - refunded / order.totalCents : 1;
      productRevenue += (order.productSubtotalCents ?? order.totalCents) * refundRatio;
      shippingRevenue += (order.shippingCents ?? 0) * refundRatio;
      taxCollected += (order.taxCents ?? 0) * refundRatio;
      fees += _paymentFee(order.id, order.totalCents);
    }

    const purchases = _filterPurchasesByDate(await getAllPurchases(), dateFrom as string | undefined, dateTo as string | undefined);
    const costs = purchases.reduce((s, p) => s + p.totalCents, 0);

    const azTptOwedCents = Math.round(taxCollected);
    const businessRevenueExcludingTax = productRevenue + shippingRevenue;
    const federalNetProfitCents = Math.round(businessRevenueExcludingTax - fees - costs);
    const suggestedFederalPaymentCents = federalNetProfitCents > 0 ? Math.round(federalNetProfitCents * rate) : 0;

    const label = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "all time";
    const lines = [
      `Tax Summary (${label})`,
      `────────────────────────────────`,
      `AZ TPT (sales tax) to remit: ${fmt(azTptOwedCents)}`,
      `  — tax already collected from customers; a pass-through, not income.`,
      ``,
      `Federal estimated tax planning:`,
      `  Business revenue (excl. sales tax): ${fmt(Math.round(businessRevenueExcludingTax))}`,
      `  − Payment processing fees:          ${fmt(fees)}`,
      `  − Supply/COGS purchases:            ${fmt(costs)}`,
      `  = Net profit:                       ${fmt(federalNetProfitCents)}`,
      `  Suggested set-aside (${(rate * 100).toFixed(0)}% of net profit): ${fmt(suggestedFederalPaymentCents)}`,
      ``,
      `Note: planning estimate only, not tax advice — the set-aside rate should reflect your actual bracket plus 15.3% self-employment tax.`,
    ];
    return t(lines.join("\n"));
  },
  async list_refunds({ status, limit }) {
    let refunds = await listRefunds();
    if (status) refunds = refunds.filter((r) => r.status === status);
    refunds = refunds.slice(0, Math.min(Number(limit ?? 30), 100));
    if (!refunds.length) return t("No refunds found.");
    const lines = refunds.map((r) => `• [${r.status}] ${r.orderId} — ${fmt(r.amountCents)} — ${r.reason}${r.reasonNote ? ` (${r.reasonNote})` : ""} — ${r.email}\n  ${new Date(r.createdAt).toLocaleDateString()}${r.processedAt ? ` → processed ${new Date(r.processedAt).toLocaleDateString()}` : ""}`);
    return t(`${refunds.length} refunds:\n\n${lines.join("\n")}`);
  },
};

// ---------------------------------------------------------------------------
// MCP JSON-RPC dispatcher — shared by both transports
// ---------------------------------------------------------------------------

export async function dispatchMcp(body: unknown): Promise<unknown> {
  if (!body || typeof body !== "object") {
    return { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null };
  }

  const msg = body as { method?: string; params?: unknown; id?: unknown };
  const { method, params, id } = msg;

  if (method?.startsWith("notifications/")) return null;

  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };

  if (method === "initialize") {
    const clientVersion = (params as Record<string, unknown>)?.protocolVersion ?? "2025-03-26";
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: clientVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "desert-candle-works", version: "3.0.0" },
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = (params ?? {}) as { name?: string; arguments?: Args };
    if (!name) return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } };
    const handler = MCP_HANDLERS[name];
    if (!handler) return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
    try {
      const result = await handler(args ?? {});
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      return { jsonrpc: "2.0", id, error: { code: -32000, message: String(err) } };
    }
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}
