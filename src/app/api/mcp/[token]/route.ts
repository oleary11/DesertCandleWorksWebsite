import { NextRequest, NextResponse } from "next/server";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getProductBySlug, upsertProduct } from "@/lib/productsStore";
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
import { getAllPurchases } from "@/lib/purchasesStore";
import { sendShippingConfirmationEmail, sendDeliveryConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(token: string): boolean {
  const secret = process.env.MCP_SECRET_KEY;
  if (!secret) return false;
  return token === secret;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

// ---------------------------------------------------------------------------
// MCP tool definitions (JSON Schema for tools/list)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "list_products",
    description: "List all Desert Candle Works products with stock levels, prices, and variant info.",
    inputSchema: {
      type: "object",
      properties: {
        includeHidden: { type: "boolean", description: "Include hidden products (default: false)" },
      },
    },
  },
  {
    name: "get_product",
    description: "Get full details for a single product by its slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Product slug, e.g. smoked-amber-candle" },
      },
      required: ["slug"],
    },
  },
  {
    name: "update_stock",
    description: "Set the stock quantity for a product.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Product slug" },
        stock: { type: "number", description: "New stock quantity (≥ 0)" },
      },
      required: ["slug", "stock"],
    },
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
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID, e.g. MS00012" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "mark_order_shipped",
    description: "Mark an order as shipped or delivered, add a tracking number, and send the customer a confirmation email.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        trackingNumber: { type: "string" },
        shippingStatus: { type: "string", enum: ["shipped", "delivered"] },
      },
      required: ["orderId", "trackingNumber", "shippingStatus"],
    },
  },
  {
    name: "record_manual_sale",
    description: "Record a manual (in-person) sale. Creates a completed order and optionally decrements stock.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productSlug: { type: "string" },
              productName: { type: "string" },
              quantity: { type: "number" },
              priceCents: { type: "number", description: "Price in cents per item" },
              variantId: { type: "string", description: "e.g. wood-wick-smoked-amber" },
            },
            required: ["productSlug", "productName", "quantity", "priceCents"],
          },
        },
        paymentMethod: { type: "string", enum: ["cash", "card", "other"] },
        decrementStock: { type: "boolean", description: "Reduce inventory (default: true)" },
        discountCents: { type: "number", description: "Order-level discount in cents" },
        customerEmail: { type: "string" },
        notes: { type: "string" },
      },
      required: ["items", "paymentMethod"],
    },
  },
  {
    name: "get_revenue_summary",
    description: "Total revenue, order count, and average order value for a date range, broken down by payment method.",
    inputSchema: {
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Start date (ISO string)" },
        dateTo: { type: "string", description: "End date (ISO string)" },
      },
    },
  },
  {
    name: "list_customers",
    description: "List all customer accounts (email, name, ID).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_scents",
    description: "List all available candle scents with their IDs and names.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_promotions",
    description: "List all promo codes and discount promotions, including status and redemption counts.",
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: { type: "boolean", description: "Only return active promotions" },
      },
    },
  },
  {
    name: "toggle_promotion",
    description: "Enable or disable a promotion by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        promotionId: { type: "string" },
        active: { type: "boolean", description: "true to activate, false to deactivate" },
      },
      required: ["promotionId", "active"],
    },
  },
  {
    name: "list_reviews",
    description: "List all customer reviews shown on the website.",
    inputSchema: {
      type: "object",
      properties: {
        visibleOnly: { type: "boolean", description: "Only return currently visible reviews" },
      },
    },
  },
  {
    name: "add_review",
    description: "Add a new customer review to the website.",
    inputSchema: {
      type: "object",
      properties: {
        reviewerName: { type: "string" },
        rating: { type: "number", description: "1–5" },
        text: { type: "string" },
        date: { type: "string", description: "e.g. 'March 2025' or '2025-03-15'" },
        visible: { type: "boolean", description: "Show immediately (default: true)" },
      },
      required: ["reviewerName", "rating", "text", "date"],
    },
  },
  {
    name: "toggle_review_visibility",
    description: "Show or hide a review on the website.",
    inputSchema: {
      type: "object",
      properties: {
        reviewId: { type: "string" },
      },
      required: ["reviewId"],
    },
  },
  {
    name: "list_supply_purchases",
    description: "List supply purchases (raw materials, bottles, wicks, etc.) recorded in the admin.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max to return (default: 20)" },
      },
    },
  },
  {
    name: "get_activity_logs",
    description: "Get recent admin activity logs — what actions have been taken and when.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of entries (default: 30, max: 100)" },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type Args = Record<string, unknown>;
type ToolResult = { content: Array<{ type: "text"; text: string }> };

function text(t: string): ToolResult {
  return { content: [{ type: "text", text: t }] };
}

const HANDLERS: Record<string, (args: Args) => Promise<ToolResult>> = {
  async list_products({ includeHidden }) {
    const products = await listResolvedProducts();
    const filtered = includeHidden ? products : products.filter((p) => p.visibleOnWebsite !== false);
    const lines = filtered.map(
      (p) =>
        `• ${p.name} (${p.slug})\n  Price: $${p.price.toFixed(2)} | Stock: ${p.stock} | SKU: ${p.sku}${p.variantConfig ? " | Has variants" : ""}${p.visibleOnWebsite === false ? " | HIDDEN" : ""}`
    );
    return text(`${filtered.length} products:\n\n${lines.join("\n")}`);
  },

  async get_product({ slug }) {
    const product = await getProductBySlug(slug as string);
    return text(product ? JSON.stringify(product, null, 2) : `No product found with slug: ${slug}`);
  },

  async update_stock({ slug, stock }) {
    const product = await getProductBySlug(slug as string);
    if (!product) return text(`Error: No product found with slug: ${slug}`);
    const oldStock = product.stock;
    await upsertProduct({ ...product, stock: stock as number });
    return text(`Updated stock for "${product.name}" (${slug}): ${oldStock} → ${stock}`);
  },

  async get_inventory_summary() {
    const products = await listResolvedProducts();
    const visible = products.filter((p) => p.visibleOnWebsite !== false);
    const outOfStock = visible.filter((p) => p.stock === 0);
    const lowStock = visible.filter((p) => p.stock > 0 && p.stock < 3);
    const healthy = visible.filter((p) => p.stock >= 3);
    const lines = [
      `Inventory Summary (${visible.length} products)`,
      `  Healthy stock (≥3): ${healthy.length}`,
      `  Low stock (1-2):    ${lowStock.length}`,
      `  Out of stock:       ${outOfStock.length}`,
      "",
    ];
    if (lowStock.length > 0) {
      lines.push("Low stock:");
      lowStock.forEach((p) => lines.push(`  • ${p.name} — ${p.stock} left`));
      lines.push("");
    }
    if (outOfStock.length > 0) {
      lines.push("Out of stock:");
      outOfStock.forEach((p) => lines.push(`  • ${p.name}`));
    }
    return text(lines.join("\n"));
  },

  async list_orders({ limit, status, dateFrom, dateTo, paymentMethod }) {
    const maxLimit = Math.min(Number(limit ?? 20), 100);
    const from = dateFrom ? new Date(dateFrom as string) : null;
    const to = dateTo ? new Date(dateTo as string) : null;

    let orders = await getAllOrders();
    orders = orders.filter((o) => !o.email.includes("@admin.local"));
    if (status) orders = orders.filter((o) => o.status === status);
    if (paymentMethod) orders = orders.filter((o) => o.paymentMethod?.toLowerCase().includes((paymentMethod as string).toLowerCase()));
    if (from) orders = orders.filter((o) => new Date(o.createdAt) >= from);
    if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); orders = orders.filter((o) => new Date(o.createdAt) <= end); }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    orders = orders.slice(0, maxLimit);

    if (orders.length === 0) return text("No orders found matching the given filters.");

    const lines = orders.map((o) => {
      const date = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const total = `$${(o.totalCents / 100).toFixed(2)}`;
      const itemSummary = o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ");
      const tracking = o.trackingNumber ? ` | tracking: ${o.trackingNumber}` : "";
      return `[${o.id}] ${date} — ${o.email} — ${total} (${o.paymentMethod ?? "?"}) — ${o.status}${tracking}\n  Items: ${itemSummary}`;
    });
    return text(`${orders.length} orders:\n\n${lines.join("\n")}`);
  },

  async get_order({ orderId }) {
    const order = await getOrderById(orderId as string);
    return text(order ? JSON.stringify(order, null, 2) : `No order found with ID: ${orderId}`);
  },

  async mark_order_shipped({ orderId, trackingNumber, shippingStatus }) {
    const order = await getOrderById(orderId as string);
    if (!order) return text(`Error: No order found with ID: ${orderId}`);

    await updateOrderShipping(orderId as string, trackingNumber as string, shippingStatus as "shipped" | "delivered");

    let emailNote = "";
    try {
      if (shippingStatus === "shipped") {
        await sendShippingConfirmationEmail(orderId as string, trackingNumber as string);
        emailNote = " Shipping confirmation email sent to customer.";
      } else {
        await sendDeliveryConfirmationEmail(orderId as string, trackingNumber as string);
        emailNote = " Delivery confirmation email sent to customer.";
      }
    } catch {
      emailNote = " (Email failed to send — order still updated.)";
    }

    return text(`Order ${orderId} marked as ${shippingStatus}. Tracking: ${trackingNumber}.${emailNote}`);
  },

  async record_manual_sale({ items, paymentMethod, decrementStock, discountCents, customerEmail, notes }) {
    const { incrStock, incrVariantStock } = await import("@/lib/productsStore");
    type SaleItem = { productSlug: string; productName: string; quantity: number; priceCents: number; variantId?: string };
    const saleItems = items as SaleItem[];
    const shouldDecrement = decrementStock !== false;
    const discount = (discountCents as number) ?? 0;
    const email = (customerEmail as string) ?? "manual-sale@admin.local";
    const subtotalCents = saleItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    const totalCents = Math.max(0, subtotalCents - discount);
    const orderId = await generateOrderId("manual");

    if (shouldDecrement) {
      for (const item of saleItems) {
        try {
          if (item.variantId) {
            await incrVariantStock(item.productSlug, item.variantId, -item.quantity);
          } else {
            await incrStock(item.productSlug, -item.quantity);
          }
        } catch (err) {
          return text(`Error: Failed to decrement stock for ${item.productName}: ${String(err)}`);
        }
      }
    }

    await createOrder(email, orderId, totalCents, saleItems.map((i) => ({ productSlug: i.productSlug, productName: i.productName, quantity: i.quantity, priceCents: i.priceCents, variantId: i.variantId })), undefined, undefined, undefined, undefined, paymentMethod as string, notes as string | undefined);
    await completeOrder(orderId);

    const msg = [
      `Sale recorded! Order ID: ${orderId}`,
      `Items: ${saleItems.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}`,
      `Total: $${(totalCents / 100).toFixed(2)} (${paymentMethod})`,
      discount > 0 ? `Discount: $${(discount / 100).toFixed(2)}` : null,
      notes ? `Notes: ${notes}` : null,
    ].filter(Boolean).join("\n");

    return text(msg);
  },

  async get_revenue_summary({ dateFrom, dateTo }) {
    const from = dateFrom ? new Date(dateFrom as string) : null;
    const to = dateTo ? new Date(dateTo as string) : null;

    let orders = await getAllOrders();
    orders = orders.filter((o) => o.status === "completed" && !o.email.includes("@admin.local"));
    if (from) orders = orders.filter((o) => new Date(o.createdAt) >= from);
    if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); orders = orders.filter((o) => new Date(o.createdAt) <= end); }

    if (orders.length === 0) return text("No completed orders found for the given date range.");

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const byMethod: Record<string, { count: number; totalCents: number }> = {};
    for (const o of orders) {
      const m = o.paymentMethod ?? "unknown";
      if (!byMethod[m]) byMethod[m] = { count: 0, totalCents: 0 };
      byMethod[m].count++;
      byMethod[m].totalCents += o.totalCents;
    }

    const dateLabel = from || to ? ` (${from ? from.toLocaleDateString() : "all time"} – ${to ? to.toLocaleDateString() : "now"})` : "";
    const msg = [
      `Revenue Summary${dateLabel}`,
      `  Orders:        ${orders.length}`,
      `  Total revenue: $${(totalRevenue / 100).toFixed(2)}`,
      `  Average order: $${(totalRevenue / orders.length / 100).toFixed(2)}`,
      "",
      "By payment method:",
      ...Object.entries(byMethod).map(([m, d]) => `  ${m.padEnd(12)} ${String(d.count).padStart(3)} orders   $${(d.totalCents / 100).toFixed(2)}`),
    ].join("\n");

    return text(msg);
  },

  async list_customers() {
    const users = await listAllUsers();
    if (users.length === 0) return text("No customer accounts found.");
    const lines = users.map((u) => `• ${u.firstName} ${u.lastName} — ${u.email} (id: ${u.id})`);
    return text(`${users.length} customers:\n\n${lines.join("\n")}`);
  },

  async list_scents() {
    const scents = await getAllScents();
    if (scents.length === 0) return text("No scents found.");
    const lines = scents
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name))
      .map((s) => {
        const flags = [s.limited ? "limited" : null, s.seasonal ? "seasonal" : null].filter(Boolean).join(", ");
        return `• ${s.name} (id: ${s.id})${flags ? ` [${flags}]` : ""}`;
      });
    return text(`${scents.length} scents:\n\n${lines.join("\n")}`);
  },

  async list_promotions({ activeOnly }) {
    let promos = await listPromotions();
    if (activeOnly) promos = promos.filter((p) => p.active);
    if (promos.length === 0) return text("No promotions found.");
    const lines = promos.map((p) => {
      const discount = p.type === "percentage" ? `${p.discountPercent}% off` : p.type === "fixed_amount" ? `$${((p.discountAmountCents ?? 0) / 100).toFixed(2)} off` : p.type;
      const expiry = p.expiresAt ? `expires ${new Date(p.expiresAt).toLocaleDateString()}` : "no expiry";
      const uses = `${p.currentRedemptions}${p.maxRedemptions ? `/${p.maxRedemptions}` : ""} uses`;
      return `• [${p.active ? "ACTIVE" : "inactive"}] ${p.code} — ${p.name}\n  ${discount} | ${uses} | ${expiry}\n  ID: ${p.id}`;
    });
    return text(`${promos.length} promotions:\n\n${lines.join("\n")}`);
  },

  async toggle_promotion({ promotionId, active }) {
    const promo = await getPromotionById(promotionId as string);
    if (!promo) return text(`Error: No promotion found with ID: ${promotionId}`);
    await updatePromotion(promotionId as string, { active: active as boolean });
    return text(`Promotion "${promo.code}" (${promo.name}) is now ${active ? "ACTIVE" : "INACTIVE"}.`);
  },

  async list_reviews({ visibleOnly }) {
    let reviews = await getAllReviews();
    if (visibleOnly) reviews = reviews.filter((r) => r.visible);
    if (reviews.length === 0) return text("No reviews found.");
    const lines = reviews.map((r) => {
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      return `• [${r.visible ? "visible" : "hidden"}] ${stars} ${r.reviewerName} — ${r.date}\n  "${r.text.slice(0, 100)}${r.text.length > 100 ? "…" : ""}"\n  ID: ${r.id}`;
    });
    return text(`${reviews.length} reviews:\n\n${lines.join("\n")}`);
  },

  async add_review({ reviewerName, rating, text: reviewText, date, visible }) {
    const review = {
      id: generateReviewId(),
      reviewerName: reviewerName as string,
      reviewerInitials: generateInitials(reviewerName as string),
      rating: rating as number,
      text: reviewText as string,
      date: date as string,
      importedAt: new Date().toISOString(),
      visible: visible !== false,
    };
    await upsertReview(review);
    return text(`Review added from ${reviewerName} (${rating} stars). ID: ${review.id}. Visible: ${review.visible}.`);
  },

  async toggle_review_visibility({ reviewId }) {
    const review = await toggleReviewVisibility(reviewId as string);
    if (!review) return text(`Error: No review found with ID: ${reviewId}`);
    return text(`Review by ${review.reviewerName} is now ${review.visible ? "VISIBLE" : "HIDDEN"} on the website.`);
  },

  async list_supply_purchases({ limit }) {
    const purchases = await getAllPurchases();
    const sorted = purchases
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
      .slice(0, Math.min(Number(limit ?? 20), 100));
    if (sorted.length === 0) return text("No supply purchases recorded.");
    const totalSpend = purchases.reduce((sum, p) => sum + p.totalCents, 0);
    const lines = sorted.map((p) => {
      const itemNames = p.items.slice(0, 3).map((i) => i.name).join(", ");
      return `• ${p.purchaseDate} — ${p.vendorName} — $${(p.totalCents / 100).toFixed(2)} (${p.items.length} items)\n  ${itemNames}${p.items.length > 3 ? ` +${p.items.length - 3} more` : ""}`;
    });
    return text([`${sorted.length} purchases (${purchases.length} total, $${(totalSpend / 100).toFixed(2)} all-time):`, "", ...lines].join("\n"));
  },

  async get_activity_logs({ limit }) {
    const logs = await getAdminLogs(Math.min(Number(limit ?? 30), 100));
    if (logs.length === 0) return text("No activity logs found.");
    const lines = logs.map((l) => {
      const time = new Date(l.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return `${l.success ? "✓" : "✗"} [${time}] ${l.action}${l.adminEmail ? ` by ${l.adminEmail}` : ""}`;
    });
    return text(`${logs.length} recent actions:\n\n${lines.join("\n")}`);
  },
};

// ---------------------------------------------------------------------------
// MCP JSON-RPC handler
// ---------------------------------------------------------------------------

async function handleMcp(body: unknown): Promise<unknown> {
  if (!body || typeof body !== "object") {
    return { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null };
  }

  const { method, params, id } = body as { method?: string; params?: unknown; id?: unknown };

  // Notifications — no response
  if (!id && method?.startsWith("notifications/")) {
    return null;
  }

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "desert-candle-works", version: "2.0.0" },
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = (params ?? {}) as { name?: string; arguments?: Args };
    if (!name) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } };
    }
    const handler = HANDLERS[name];
    if (!handler) {
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
    }
    try {
      const result = await handler(args ?? {});
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      return { jsonrpc: "2.0", id, error: { code: -32000, message: String(err) } };
    }
  }

  // ping / anything else
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isAuthorized(token)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });
  // SSE not supported in serverless — tell clients to use POST
  return new NextResponse(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isAuthorized(token)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }, 400);
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(handleMcp));
    const responses = results.filter((r) => r !== null);
    return json(responses);
  }

  const result = await handleMcp(body);
  if (result === null) {
    // Notification — no content
    return new NextResponse(null, { status: 202, headers: CORS });
  }
  return json(result);
}
