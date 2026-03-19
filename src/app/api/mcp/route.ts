import { NextRequest, NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
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
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Auth — token passed as ?token=SECRET in the URL
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.MCP_SECRET_KEY;
  if (!secret) return false;
  const token = req.nextUrl.searchParams.get("token");
  return token === secret;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

// ---------------------------------------------------------------------------
// MCP handler (built once at module load)
// ---------------------------------------------------------------------------

const mcpHandler = createMcpHandler(
  (server) => {
    // ── Products ────────────────────────────────────────────────────────────

    server.tool(
      "list_products",
      "List all Desert Candle Works products with stock levels, prices, and variant info.",
      { includeHidden: z.boolean().optional().describe("Include hidden products (default: false)") },
      async ({ includeHidden }) => {
        const products = await listResolvedProducts();
        const filtered = includeHidden ? products : products.filter((p) => p.visibleOnWebsite !== false);
        const lines = filtered.map(
          (p) =>
            `• ${p.name} (${p.slug})\n  Price: $${p.price.toFixed(2)} | Stock: ${p.stock} | SKU: ${p.sku}${p.variantConfig ? " | Has variants" : ""}${p.visibleOnWebsite === false ? " | HIDDEN" : ""}`
        );
        return { content: [{ type: "text" as const, text: `${filtered.length} products:\n\n${lines.join("\n")}` }] };
      }
    );

    server.tool(
      "get_product",
      "Get full details for a single product by its slug.",
      { slug: z.string().describe("Product slug, e.g. smoked-amber-candle") },
      async ({ slug }) => {
        const product = await getProductBySlug(slug);
        return { content: [{ type: "text" as const, text: product ? JSON.stringify(product, null, 2) : `No product found with slug: ${slug}` }] };
      }
    );

    server.tool(
      "update_stock",
      "Set the stock quantity for a product.",
      {
        slug: z.string().describe("Product slug"),
        stock: z.number().min(0).describe("New stock quantity"),
      },
      async ({ slug, stock }) => {
        const product = await getProductBySlug(slug);
        if (!product) return { content: [{ type: "text" as const, text: `Error: No product found with slug: ${slug}` }] };
        const oldStock = product.stock;
        await upsertProduct({ ...product, stock });
        return { content: [{ type: "text" as const, text: `Updated stock for "${product.name}" (${slug}): ${oldStock} → ${stock}` }] };
      }
    );

    server.tool(
      "get_inventory_summary",
      "Inventory report: total products, out-of-stock, low-stock (< 3), and which products need restocking.",
      {},
      async () => {
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
        if (lowStock.length > 0) { lines.push("Low stock:"); lowStock.forEach((p) => lines.push(`  • ${p.name} — ${p.stock} left`)); lines.push(""); }
        if (outOfStock.length > 0) { lines.push("Out of stock:"); outOfStock.forEach((p) => lines.push(`  • ${p.name}`)); }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }
    );

    // ── Orders ──────────────────────────────────────────────────────────────

    server.tool(
      "list_orders",
      "List orders with optional filters. Returns customer, total, items, and status.",
      {
        limit: z.number().optional().describe("Max orders to return (default: 20, max: 100)"),
        status: z.enum(["pending", "completed", "cancelled"]).optional(),
        dateFrom: z.string().optional().describe("ISO date string — on or after"),
        dateTo: z.string().optional().describe("ISO date string — on or before"),
        paymentMethod: z.string().optional().describe("Filter by payment method (cash, card, stripe, square, etc.)"),
      },
      async ({ limit, status, dateFrom, dateTo, paymentMethod }) => {
        const maxLimit = Math.min(Number(limit ?? 20), 100);
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        let orders = await getAllOrders();
        orders = orders.filter((o) => !o.email.includes("@admin.local"));
        if (status) orders = orders.filter((o) => o.status === status);
        if (paymentMethod) orders = orders.filter((o) => o.paymentMethod?.toLowerCase().includes(paymentMethod.toLowerCase()));
        if (from) orders = orders.filter((o) => new Date(o.createdAt) >= from);
        if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); orders = orders.filter((o) => new Date(o.createdAt) <= end); }
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        orders = orders.slice(0, maxLimit);
        if (orders.length === 0) return { content: [{ type: "text" as const, text: "No orders found matching the given filters." }] };
        const lines = orders.map((o) => {
          const date = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const tracking = o.trackingNumber ? ` | tracking: ${o.trackingNumber}` : "";
          return `[${o.id}] ${date} — ${o.email} — $${(o.totalCents / 100).toFixed(2)} (${o.paymentMethod ?? "?"}) — ${o.status}${tracking}\n  Items: ${o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}`;
        });
        return { content: [{ type: "text" as const, text: `${orders.length} orders:\n\n${lines.join("\n")}` }] };
      }
    );

    server.tool(
      "get_order",
      "Get full details for a single order by its ID.",
      { orderId: z.string().describe("The order ID, e.g. MS00012") },
      async ({ orderId }) => {
        const order = await getOrderById(orderId);
        return { content: [{ type: "text" as const, text: order ? JSON.stringify(order, null, 2) : `No order found with ID: ${orderId}` }] };
      }
    );

    server.tool(
      "mark_order_shipped",
      "Mark an order as shipped or delivered, add a tracking number, and send the customer a confirmation email.",
      {
        orderId: z.string(),
        trackingNumber: z.string(),
        shippingStatus: z.enum(["shipped", "delivered"]),
      },
      async ({ orderId, trackingNumber, shippingStatus }) => {
        const order = await getOrderById(orderId);
        if (!order) return { content: [{ type: "text" as const, text: `Error: No order found with ID: ${orderId}` }] };
        await updateOrderShipping(orderId, trackingNumber, shippingStatus);
        let emailNote = "";
        try {
          if (shippingStatus === "shipped") { await sendShippingConfirmationEmail(orderId, trackingNumber); emailNote = " Shipping confirmation email sent."; }
          else { await sendDeliveryConfirmationEmail(orderId, trackingNumber); emailNote = " Delivery confirmation email sent."; }
        } catch { emailNote = " (Email failed — order still updated.)"; }
        return { content: [{ type: "text" as const, text: `Order ${orderId} marked as ${shippingStatus}. Tracking: ${trackingNumber}.${emailNote}` }] };
      }
    );

    server.tool(
      "record_manual_sale",
      "Record a manual (in-person) sale. Creates a completed order and optionally decrements stock.",
      {
        items: z.array(z.object({
          productSlug: z.string(),
          productName: z.string(),
          quantity: z.number().min(1),
          priceCents: z.number().min(0).describe("Price in cents per item"),
          variantId: z.string().optional().describe("e.g. wood-wick-smoked-amber"),
        })),
        paymentMethod: z.enum(["cash", "card", "other"]),
        decrementStock: z.boolean().optional().describe("Reduce inventory (default: true)"),
        discountCents: z.number().optional().describe("Order-level discount in cents"),
        customerEmail: z.string().optional(),
        notes: z.string().optional(),
      },
      async ({ items, paymentMethod, decrementStock, discountCents, customerEmail, notes }) => {
        const { incrStock, incrVariantStock } = await import("@/lib/productsStore");
        type SaleItem = { productSlug: string; productName: string; quantity: number; priceCents: number; variantId?: string };
        const shouldDecrement = decrementStock !== false;
        const discount = discountCents ?? 0;
        const email = customerEmail ?? "manual-sale@admin.local";
        const subtotalCents = items.reduce((sum, i: SaleItem) => sum + i.priceCents * i.quantity, 0);
        const totalCents = Math.max(0, subtotalCents - discount);
        const orderId = await generateOrderId("manual");
        if (shouldDecrement) {
          for (const item of items as SaleItem[]) {
            try {
              if (item.variantId) { await incrVariantStock(item.productSlug, item.variantId, -item.quantity); }
              else { await incrStock(item.productSlug, -item.quantity); }
            } catch (err) { return { content: [{ type: "text" as const, text: `Error: Failed to decrement stock for ${item.productName}: ${String(err)}` }] }; }
          }
        }
        await createOrder(email, orderId, totalCents, (items as SaleItem[]).map((i) => ({ productSlug: i.productSlug, productName: i.productName, quantity: i.quantity, priceCents: i.priceCents, variantId: i.variantId })), undefined, undefined, undefined, undefined, paymentMethod, notes);
        await completeOrder(orderId);
        const msg = [`Sale recorded! Order ID: ${orderId}`, `Items: ${(items as SaleItem[]).map((i) => `${i.quantity}× ${i.productName}`).join(", ")}`, `Total: $${(totalCents / 100).toFixed(2)} (${paymentMethod})`, discount > 0 ? `Discount: $${(discount / 100).toFixed(2)}` : null, notes ? `Notes: ${notes}` : null].filter(Boolean).join("\n");
        return { content: [{ type: "text" as const, text: msg }] };
      }
    );

    // ── Revenue ─────────────────────────────────────────────────────────────

    server.tool(
      "get_revenue_summary",
      "Total revenue, order count, and average order value for a date range, broken down by payment method.",
      {
        dateFrom: z.string().optional().describe("Start date (ISO string)"),
        dateTo: z.string().optional().describe("End date (ISO string)"),
      },
      async ({ dateFrom, dateTo }) => {
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        let orders = await getAllOrders();
        orders = orders.filter((o) => o.status === "completed" && !o.email.includes("@admin.local"));
        if (from) orders = orders.filter((o) => new Date(o.createdAt) >= from);
        if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); orders = orders.filter((o) => new Date(o.createdAt) <= end); }
        if (orders.length === 0) return { content: [{ type: "text" as const, text: "No completed orders found for the given date range." }] };
        const totalRevenue = orders.reduce((sum, o) => sum + o.totalCents, 0);
        const byMethod: Record<string, { count: number; totalCents: number }> = {};
        for (const o of orders) { const m = o.paymentMethod ?? "unknown"; if (!byMethod[m]) byMethod[m] = { count: 0, totalCents: 0 }; byMethod[m].count++; byMethod[m].totalCents += o.totalCents; }
        const dateLabel = from || to ? ` (${from ? from.toLocaleDateString() : "all time"} – ${to ? to.toLocaleDateString() : "now"})` : "";
        const msg = [`Revenue Summary${dateLabel}`, `  Orders:        ${orders.length}`, `  Total revenue: $${(totalRevenue / 100).toFixed(2)}`, `  Average order: $${(totalRevenue / orders.length / 100).toFixed(2)}`, "", "By payment method:", ...Object.entries(byMethod).map(([m, d]) => `  ${m.padEnd(12)} ${String(d.count).padStart(3)} orders   $${(d.totalCents / 100).toFixed(2)}`)].join("\n");
        return { content: [{ type: "text" as const, text: msg }] };
      }
    );

    // ── Customers ───────────────────────────────────────────────────────────

    server.tool("list_customers", "List all customer accounts (email, name, ID).", {}, async () => {
      const users = await listAllUsers();
      if (users.length === 0) return { content: [{ type: "text" as const, text: "No customer accounts found." }] };
      return { content: [{ type: "text" as const, text: `${users.length} customers:\n\n${users.map((u) => `• ${u.firstName} ${u.lastName} — ${u.email} (id: ${u.id})`).join("\n")}` }] };
    });

    // ── Scents ──────────────────────────────────────────────────────────────

    server.tool("list_scents", "List all available candle scents with their IDs and names.", {}, async () => {
      const scents = await getAllScents();
      if (scents.length === 0) return { content: [{ type: "text" as const, text: "No scents found." }] };
      const lines = scents.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name)).map((s) => { const flags = [s.limited ? "limited" : null, s.seasonal ? "seasonal" : null].filter(Boolean).join(", "); return `• ${s.name} (id: ${s.id})${flags ? ` [${flags}]` : ""}`; });
      return { content: [{ type: "text" as const, text: `${scents.length} scents:\n\n${lines.join("\n")}` }] };
    });

    // ── Promotions ──────────────────────────────────────────────────────────

    server.tool(
      "list_promotions",
      "List all promo codes and discount promotions, including status and redemption counts.",
      { activeOnly: z.boolean().optional().describe("Only return active promotions") },
      async ({ activeOnly }) => {
        let promos = await listPromotions();
        if (activeOnly) promos = promos.filter((p) => p.active);
        if (promos.length === 0) return { content: [{ type: "text" as const, text: "No promotions found." }] };
        const lines = promos.map((p) => { const discount = p.type === "percentage" ? `${p.discountPercent}% off` : p.type === "fixed_amount" ? `$${((p.discountAmountCents ?? 0) / 100).toFixed(2)} off` : p.type; const expiry = p.expiresAt ? `expires ${new Date(p.expiresAt).toLocaleDateString()}` : "no expiry"; return `• [${p.active ? "ACTIVE" : "inactive"}] ${p.code} — ${p.name}\n  ${discount} | ${p.currentRedemptions}${p.maxRedemptions ? `/${p.maxRedemptions}` : ""} uses | ${expiry}\n  ID: ${p.id}`; });
        return { content: [{ type: "text" as const, text: `${promos.length} promotions:\n\n${lines.join("\n")}` }] };
      }
    );

    server.tool(
      "toggle_promotion",
      "Enable or disable a promotion by its ID.",
      { promotionId: z.string(), active: z.boolean().describe("true to activate, false to deactivate") },
      async ({ promotionId, active }) => {
        const promo = await getPromotionById(promotionId);
        if (!promo) return { content: [{ type: "text" as const, text: `Error: No promotion found with ID: ${promotionId}` }] };
        await updatePromotion(promotionId, { active });
        return { content: [{ type: "text" as const, text: `Promotion "${promo.code}" (${promo.name}) is now ${active ? "ACTIVE" : "INACTIVE"}.` }] };
      }
    );

    // ── Reviews ─────────────────────────────────────────────────────────────

    server.tool(
      "list_reviews",
      "List all customer reviews shown on the website.",
      { visibleOnly: z.boolean().optional().describe("Only return currently visible reviews") },
      async ({ visibleOnly }) => {
        let reviews = await getAllReviews();
        if (visibleOnly) reviews = reviews.filter((r) => r.visible);
        if (reviews.length === 0) return { content: [{ type: "text" as const, text: "No reviews found." }] };
        const lines = reviews.map((r) => { const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating); return `• [${r.visible ? "visible" : "hidden"}] ${stars} ${r.reviewerName} — ${r.date}\n  "${r.text.slice(0, 100)}${r.text.length > 100 ? "…" : ""}"\n  ID: ${r.id}`; });
        return { content: [{ type: "text" as const, text: `${reviews.length} reviews:\n\n${lines.join("\n")}` }] };
      }
    );

    server.tool(
      "add_review",
      "Add a new customer review to the website.",
      { reviewerName: z.string(), rating: z.number().min(1).max(5), text: z.string(), date: z.string().describe("e.g. 'March 2025'"), visible: z.boolean().optional().describe("Show immediately (default: true)") },
      async ({ reviewerName, rating, text: reviewText, date, visible }) => {
        const review = { id: generateReviewId(), reviewerName, reviewerInitials: generateInitials(reviewerName), rating, text: reviewText, date, importedAt: new Date().toISOString(), visible: visible !== false };
        await upsertReview(review);
        return { content: [{ type: "text" as const, text: `Review added from ${reviewerName} (${rating} stars). ID: ${review.id}. Visible: ${review.visible}.` }] };
      }
    );

    server.tool(
      "toggle_review_visibility",
      "Show or hide a review on the website.",
      { reviewId: z.string() },
      async ({ reviewId }) => {
        const review = await toggleReviewVisibility(reviewId);
        if (!review) return { content: [{ type: "text" as const, text: `Error: No review found with ID: ${reviewId}` }] };
        return { content: [{ type: "text" as const, text: `Review by ${review.reviewerName} is now ${review.visible ? "VISIBLE" : "HIDDEN"} on the website.` }] };
      }
    );

    // ── Supply Purchases ────────────────────────────────────────────────────

    server.tool(
      "list_supply_purchases",
      "List supply purchases (raw materials, bottles, wicks, etc.) recorded in the admin.",
      { limit: z.number().optional().describe("Max to return (default: 20)") },
      async ({ limit }) => {
        const purchases = await getAllPurchases();
        const sorted = purchases.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()).slice(0, Math.min(Number(limit ?? 20), 100));
        if (sorted.length === 0) return { content: [{ type: "text" as const, text: "No supply purchases recorded." }] };
        const totalSpend = purchases.reduce((sum, p) => sum + p.totalCents, 0);
        const lines = sorted.map((p) => { const itemNames = p.items.slice(0, 3).map((i) => i.name).join(", "); return `• ${p.purchaseDate} — ${p.vendorName} — $${(p.totalCents / 100).toFixed(2)} (${p.items.length} items)\n  ${itemNames}${p.items.length > 3 ? ` +${p.items.length - 3} more` : ""}`; });
        return { content: [{ type: "text" as const, text: [`${sorted.length} purchases (${purchases.length} total, $${(totalSpend / 100).toFixed(2)} all-time):`, "", ...lines].join("\n") }] };
      }
    );

    // ── Activity Logs ───────────────────────────────────────────────────────

    server.tool(
      "get_activity_logs",
      "Get recent admin activity logs — what actions have been taken and when.",
      { limit: z.number().optional().describe("Number of entries (default: 30, max: 100)") },
      async ({ limit }) => {
        const logs = await getAdminLogs(Math.min(Number(limit ?? 30), 100));
        if (logs.length === 0) return { content: [{ type: "text" as const, text: "No activity logs found." }] };
        const lines = logs.map((l) => { const time = new Date(l.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); return `${l.success ? "✓" : "✗"} [${time}] ${l.action}${l.adminEmail ? ` by ${l.adminEmail}` : ""}`; });
        return { content: [{ type: "text" as const, text: `${logs.length} recent actions:\n\n${lines.join("\n")}` }] };
      }
    );
  },
  { serverInfo: { name: "desert-candle-works", version: "2.0.0" } },
  { basePath: "/api", disableSse: true, maxDuration: 60 }
);

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Patch the Accept header so mcp-handler doesn't reject Claude.ai's httpx client. */
async function patchedRequest(req: NextRequest): Promise<Request> {
  // Read body as text first to avoid the ReadableStream "duplex" error when
  // reconstructing a Request with a body.
  const body = req.method !== "GET" && req.method !== "DELETE" ? await req.text() : undefined;
  const headers = new Headers(req.headers);
  headers.set("accept", "application/json, text/event-stream");
  return new Request(req.url, {
    method: req.method,
    headers,
    body: body || undefined,
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });
  return mcpHandler(await patchedRequest(req));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });
  return mcpHandler(await patchedRequest(req));
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });
  return mcpHandler(await patchedRequest(req));
}
