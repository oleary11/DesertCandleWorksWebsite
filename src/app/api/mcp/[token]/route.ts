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
import {
  listPromotions,
  getPromotionById,
  updatePromotion,
} from "@/lib/promotionsStore";
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
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  // ── Products ──────────────────────────────────────────────────────────────
  {
    name: "list_products",
    description:
      "List all Desert Candle Works products with their stock levels, prices, and variant info.",
    inputSchema: {
      type: "object",
      properties: {
        includeHidden: {
          type: "boolean",
          description: "Include products not visible on the website (default: false)",
        },
      },
      required: [],
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
    description: "Set the stock quantity for a product (base stock, not variant-level).",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Product slug" },
        stock: { type: "number", description: "New stock quantity (must be >= 0)" },
      },
      required: ["slug", "stock"],
    },
  },
  {
    name: "get_inventory_summary",
    description:
      "Quick inventory report: total products, out-of-stock, low-stock (< 3), and which products need restocking.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  // ── Orders ────────────────────────────────────────────────────────────────
  {
    name: "list_orders",
    description: "List orders with optional filters. Returns customer, total, items, and status.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max orders to return (default: 20, max: 100)",
        },
        status: {
          type: "string",
          enum: ["pending", "completed", "cancelled"],
          description: "Filter by order status",
        },
        dateFrom: {
          type: "string",
          description: "ISO date string — include orders on or after this date",
        },
        dateTo: {
          type: "string",
          description: "ISO date string — include orders on or before this date",
        },
        paymentMethod: {
          type: "string",
          description: "Filter by payment method (cash, card, stripe, square, etc.)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_order",
    description: "Get full details for a single order by its ID (e.g. MS00012, PI-abc123).",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "mark_order_shipped",
    description:
      "Mark an order as shipped or delivered, add a tracking number, and automatically send the customer a confirmation email.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        trackingNumber: {
          type: "string",
          description: "Shipping carrier tracking number",
        },
        shippingStatus: {
          type: "string",
          enum: ["shipped", "delivered"],
          description: "New shipping status",
        },
      },
      required: ["orderId", "trackingNumber", "shippingStatus"],
    },
  },
  {
    name: "record_manual_sale",
    description:
      "Record a manual (in-person) sale. Creates a completed order and optionally decrements stock.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Items sold",
          items: {
            type: "object",
            properties: {
              productSlug: { type: "string" },
              productName: { type: "string" },
              quantity: { type: "number" },
              priceCents: { type: "number", description: "Price in cents per item" },
              variantId: { type: "string", description: "e.g. wood-wick-smoked-amber" },
              scentName: { type: "string" },
            },
            required: ["productSlug", "productName", "quantity", "priceCents"],
          },
        },
        paymentMethod: {
          type: "string",
          enum: ["cash", "card", "other"],
        },
        decrementStock: {
          type: "boolean",
          description: "Reduce inventory counts (default: true)",
        },
        discountCents: { type: "number", description: "Order-level discount in cents" },
        customerEmail: { type: "string" },
        notes: { type: "string" },
      },
      required: ["items", "paymentMethod"],
    },
  },
  // ── Revenue / Analytics ───────────────────────────────────────────────────
  {
    name: "get_revenue_summary",
    description:
      "Total revenue, order count, and average order value for a date range, broken down by payment method.",
    inputSchema: {
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Start date (ISO string)" },
        dateTo: { type: "string", description: "End date (ISO string)" },
      },
      required: [],
    },
  },
  // ── Customers ─────────────────────────────────────────────────────────────
  {
    name: "list_customers",
    description: "List all customer accounts (email, name, ID).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  // ── Scents ────────────────────────────────────────────────────────────────
  {
    name: "list_scents",
    description: "List all available candle scents with their IDs and names.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  // ── Promotions ────────────────────────────────────────────────────────────
  {
    name: "list_promotions",
    description:
      "List all promo codes and discount promotions, including active/inactive status and redemption counts.",
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: {
          type: "boolean",
          description: "Only return active promotions (default: false)",
        },
      },
      required: [],
    },
  },
  {
    name: "toggle_promotion",
    description: "Enable or disable a promotion by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        promotionId: { type: "string", description: "Promotion ID" },
        active: { type: "boolean", description: "true to activate, false to deactivate" },
      },
      required: ["promotionId", "active"],
    },
  },
  // ── Reviews ───────────────────────────────────────────────────────────────
  {
    name: "list_reviews",
    description: "List all customer reviews shown on the website.",
    inputSchema: {
      type: "object",
      properties: {
        visibleOnly: {
          type: "boolean",
          description: "Only return reviews that are currently visible (default: false)",
        },
      },
      required: [],
    },
  },
  {
    name: "add_review",
    description: "Add a new customer review to the website.",
    inputSchema: {
      type: "object",
      properties: {
        reviewerName: { type: "string", description: "Customer name" },
        rating: { type: "number", description: "Rating from 1 to 5" },
        text: { type: "string", description: "Review text" },
        date: {
          type: "string",
          description: "Review date (ISO string or readable date like 'March 2025')",
        },
        visible: {
          type: "boolean",
          description: "Show on website immediately (default: true)",
        },
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
        reviewId: { type: "string", description: "Review ID" },
      },
      required: ["reviewId"],
    },
  },
  // ── Supply Purchases ──────────────────────────────────────────────────────
  {
    name: "list_supply_purchases",
    description:
      "List all supply purchases (raw materials, bottles, wicks, etc.) recorded in the admin.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max purchases to return (default: 20)" },
      },
      required: [],
    },
  },
  // ── Activity Logs ─────────────────────────────────────────────────────────
  {
    name: "get_activity_logs",
    description: "Get recent admin activity logs — what actions have been taken and when.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of log entries to return (default: 30, max: 100)",
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolListProducts(input: Record<string, unknown>) {
  const includeHidden = input.includeHidden === true;
  const products = await listResolvedProducts();
  const filtered = includeHidden ? products : products.filter((p) => p.visibleOnWebsite !== false);

  const lines = filtered.map(
    (p) =>
      `• ${p.name} (${p.slug})\n  Price: $${p.price.toFixed(2)} | Stock: ${p.stock} | SKU: ${p.sku}${p.variantConfig ? " | Has variants" : ""}${p.visibleOnWebsite === false ? " | HIDDEN" : ""}`
  );
  return `${filtered.length} products:\n\n${lines.join("\n")}`;
}

async function toolGetProduct(input: Record<string, unknown>) {
  const slug = String(input.slug ?? "");
  if (!slug) return "Error: slug is required";
  const product = await getProductBySlug(slug);
  if (!product) return `No product found with slug: ${slug}`;
  return JSON.stringify(product, null, 2);
}

async function toolUpdateStock(input: Record<string, unknown>) {
  const slug = String(input.slug ?? "");
  const stock = Number(input.stock);
  if (!slug) return "Error: slug is required";
  if (isNaN(stock) || stock < 0) return "Error: stock must be a non-negative number";
  const product = await getProductBySlug(slug);
  if (!product) return `Error: No product found with slug: ${slug}`;
  const oldStock = product.stock;
  await upsertProduct({ ...product, stock });
  return `Updated stock for "${product.name}" (${slug}): ${oldStock} → ${stock}`;
}

async function toolGetInventorySummary() {
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
  return lines.join("\n");
}

async function toolListOrders(input: Record<string, unknown>) {
  const limit = Math.min(Number(input.limit ?? 20), 100);
  const statusFilter = input.status ? String(input.status) : null;
  const paymentFilter = input.paymentMethod ? String(input.paymentMethod) : null;
  const dateFrom = input.dateFrom ? new Date(String(input.dateFrom)) : null;
  const dateTo = input.dateTo ? new Date(String(input.dateTo)) : null;

  let orders = await getAllOrders();
  orders = orders.filter((o) => !o.email.includes("@admin.local"));
  if (statusFilter) orders = orders.filter((o) => o.status === statusFilter);
  if (paymentFilter)
    orders = orders.filter((o) =>
      o.paymentMethod?.toLowerCase().includes(paymentFilter.toLowerCase())
    );
  if (dateFrom) orders = orders.filter((o) => new Date(o.createdAt) >= dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    orders = orders.filter((o) => new Date(o.createdAt) <= end);
  }

  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  orders = orders.slice(0, limit);

  if (orders.length === 0) return "No orders found matching the given filters.";

  const lines = orders.map((o) => {
    const date = new Date(o.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const total = `$${(o.totalCents / 100).toFixed(2)}`;
    const itemSummary = o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ");
    const shipping = o.trackingNumber ? ` | tracking: ${o.trackingNumber}` : "";
    return `[${o.id}] ${date} — ${o.email} — ${total} (${o.paymentMethod ?? "?"}) — ${o.status}${shipping}\n  Items: ${itemSummary}`;
  });

  return `${orders.length} orders:\n\n${lines.join("\n")}`;
}

async function toolGetOrder(input: Record<string, unknown>) {
  const orderId = String(input.orderId ?? "");
  if (!orderId) return "Error: orderId is required";
  const order = await getOrderById(orderId);
  if (!order) return `No order found with ID: ${orderId}`;
  return JSON.stringify(order, null, 2);
}

async function toolMarkOrderShipped(input: Record<string, unknown>) {
  const orderId = String(input.orderId ?? "");
  const trackingNumber = String(input.trackingNumber ?? "");
  const shippingStatus = String(input.shippingStatus ?? "") as "shipped" | "delivered";

  if (!orderId) return "Error: orderId is required";
  if (!trackingNumber) return "Error: trackingNumber is required";
  if (!["shipped", "delivered"].includes(shippingStatus))
    return "Error: shippingStatus must be 'shipped' or 'delivered'";

  const order = await getOrderById(orderId);
  if (!order) return `Error: No order found with ID: ${orderId}`;

  await updateOrderShipping(orderId, trackingNumber, shippingStatus);

  let emailNote = "";
  try {
    if (shippingStatus === "shipped") {
      await sendShippingConfirmationEmail(orderId, trackingNumber);
      emailNote = " Shipping confirmation email sent to customer.";
    } else {
      await sendDeliveryConfirmationEmail(orderId, trackingNumber);
      emailNote = " Delivery confirmation email sent to customer.";
    }
  } catch {
    emailNote = " (Email failed to send — order still updated.)";
  }

  return `Order ${orderId} marked as ${shippingStatus}. Tracking: ${trackingNumber}.${emailNote}`;
}

async function toolRecordManualSale(input: Record<string, unknown>) {
  const items = input.items as Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
    variantId?: string;
  }>;
  const paymentMethod = String(input.paymentMethod) as "cash" | "card" | "other";
  const decrementStock = input.decrementStock !== false;
  const discountCents = Number(input.discountCents ?? 0);
  const customerEmail = input.customerEmail
    ? String(input.customerEmail)
    : "manual-sale@admin.local";
  const notes = input.notes ? String(input.notes) : undefined;

  if (!items?.length) return "Error: items array is required";
  if (!["cash", "card", "other"].includes(paymentMethod))
    return "Error: paymentMethod must be cash, card, or other";

  const { incrStock, incrVariantStock } = await import("@/lib/productsStore");
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const orderId = await generateOrderId("manual");

  if (decrementStock) {
    for (const item of items) {
      try {
        if (item.variantId) {
          await incrVariantStock(item.productSlug, item.variantId, -item.quantity);
        } else {
          await incrStock(item.productSlug, -item.quantity);
        }
      } catch (err) {
        return `Error: Failed to decrement stock for ${item.productName}: ${String(err)}`;
      }
    }
  }

  const orderItems = items.map((i) => ({
    productSlug: i.productSlug,
    productName: i.productName,
    quantity: i.quantity,
    priceCents: i.priceCents,
    variantId: i.variantId,
  }));

  await createOrder(
    customerEmail,
    orderId,
    totalCents,
    orderItems,
    undefined,
    undefined,
    undefined,
    undefined,
    paymentMethod,
    notes
  );
  await completeOrder(orderId);

  const itemList = items.map((i) => `${i.quantity}× ${i.productName}`).join(", ");
  return [
    `Sale recorded successfully!`,
    `Order ID: ${orderId}`,
    `Items: ${itemList}`,
    `Total: $${(totalCents / 100).toFixed(2)} (${paymentMethod})`,
    discountCents > 0 ? `Discount: $${(discountCents / 100).toFixed(2)}` : null,
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function toolGetRevenueSummary(input: Record<string, unknown>) {
  const dateFrom = input.dateFrom ? new Date(String(input.dateFrom)) : null;
  const dateTo = input.dateTo ? new Date(String(input.dateTo)) : null;

  let orders = await getAllOrders();
  orders = orders.filter((o) => o.status === "completed" && !o.email.includes("@admin.local"));
  if (dateFrom) orders = orders.filter((o) => new Date(o.createdAt) >= dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    orders = orders.filter((o) => new Date(o.createdAt) <= end);
  }

  if (orders.length === 0) return "No completed orders found for the given date range.";

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const avgOrder = totalRevenue / orders.length;

  const byMethod: Record<string, { count: number; totalCents: number }> = {};
  for (const o of orders) {
    const method = o.paymentMethod ?? "unknown";
    if (!byMethod[method]) byMethod[method] = { count: 0, totalCents: 0 };
    byMethod[method].count++;
    byMethod[method].totalCents += o.totalCents;
  }

  const dateLabel =
    dateFrom || dateTo
      ? ` (${dateFrom ? dateFrom.toLocaleDateString() : "all time"} – ${dateTo ? dateTo.toLocaleDateString() : "now"})`
      : "";

  return [
    `Revenue Summary${dateLabel}`,
    `  Orders:        ${orders.length}`,
    `  Total revenue: $${(totalRevenue / 100).toFixed(2)}`,
    `  Average order: $${(avgOrder / 100).toFixed(2)}`,
    "",
    "By payment method:",
    ...Object.entries(byMethod).map(
      ([m, d]) =>
        `  ${m.padEnd(12)} ${String(d.count).padStart(3)} orders   $${(d.totalCents / 100).toFixed(2)}`
    ),
  ].join("\n");
}

async function toolListCustomers() {
  const users = await listAllUsers();
  if (users.length === 0) return "No customer accounts found.";
  const lines = users.map(
    (u) => `• ${u.firstName} ${u.lastName} — ${u.email} (id: ${u.id})`
  );
  return `${users.length} customers:\n\n${lines.join("\n")}`;
}

async function toolListScents() {
  const scents = await getAllScents();
  if (scents.length === 0) return "No scents found.";
  const lines = scents
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name))
    .map((s) => {
      const flags = [s.limited ? "limited" : null, s.seasonal ? "seasonal" : null]
        .filter(Boolean)
        .join(", ");
      return `• ${s.name} (id: ${s.id})${flags ? ` [${flags}]` : ""}`;
    });
  return `${scents.length} scents:\n\n${lines.join("\n")}`;
}

async function toolListPromotions(input: Record<string, unknown>) {
  const activeOnly = input.activeOnly === true;
  let promos = await listPromotions();
  if (activeOnly) promos = promos.filter((p) => p.active);

  if (promos.length === 0) return "No promotions found.";

  const lines = promos.map((p) => {
    const discount =
      p.type === "percentage"
        ? `${p.discountPercent}% off`
        : p.type === "fixed_amount"
          ? `$${((p.discountAmountCents ?? 0) / 100).toFixed(2)} off`
          : p.type;
    const expiry = p.expiresAt
      ? `expires ${new Date(p.expiresAt).toLocaleDateString()}`
      : "no expiry";
    const redemptions = `${p.currentRedemptions}${p.maxRedemptions ? `/${p.maxRedemptions}` : ""} uses`;
    const status = p.active ? "ACTIVE" : "inactive";
    return `• [${status}] ${p.code} — ${p.name}\n  ${discount} | ${redemptions} | ${expiry}\n  ID: ${p.id}`;
  });

  return `${promos.length} promotions:\n\n${lines.join("\n")}`;
}

async function toolTogglePromotion(input: Record<string, unknown>) {
  const promotionId = String(input.promotionId ?? "");
  const active = Boolean(input.active);
  if (!promotionId) return "Error: promotionId is required";

  const promo = await getPromotionById(promotionId);
  if (!promo) return `Error: No promotion found with ID: ${promotionId}`;

  await updatePromotion(promotionId, { active });
  return `Promotion "${promo.code}" (${promo.name}) is now ${active ? "ACTIVE" : "INACTIVE"}.`;
}

async function toolListReviews(input: Record<string, unknown>) {
  const visibleOnly = input.visibleOnly === true;
  let reviews = await getAllReviews();
  if (visibleOnly) reviews = reviews.filter((r) => r.visible);

  if (reviews.length === 0) return "No reviews found.";

  const lines = reviews.map((r) => {
    const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
    const visibility = r.visible ? "visible" : "hidden";
    return `• [${visibility}] ${stars} ${r.reviewerName} — ${r.date}\n  "${r.text.slice(0, 100)}${r.text.length > 100 ? "…" : ""}"\n  ID: ${r.id}`;
  });

  return `${reviews.length} reviews:\n\n${lines.join("\n")}`;
}

async function toolAddReview(input: Record<string, unknown>) {
  const reviewerName = String(input.reviewerName ?? "");
  const rating = Number(input.rating);
  const text = String(input.text ?? "");
  const date = String(input.date ?? "");
  const visible = input.visible !== false;

  if (!reviewerName || !text || !date) return "Error: reviewerName, text, and date are required";
  if (isNaN(rating) || rating < 1 || rating > 5) return "Error: rating must be 1–5";

  const review = {
    id: generateReviewId(),
    reviewerName,
    reviewerInitials: generateInitials(reviewerName),
    rating,
    text,
    date,
    importedAt: new Date().toISOString(),
    visible,
  };

  await upsertReview(review);
  return `Review added from ${reviewerName} (${rating} stars). ID: ${review.id}. Visible: ${visible}.`;
}

async function toolToggleReviewVisibility(input: Record<string, unknown>) {
  const reviewId = String(input.reviewId ?? "");
  if (!reviewId) return "Error: reviewId is required";

  const review = await toggleReviewVisibility(reviewId);
  if (!review) return `Error: No review found with ID: ${reviewId}`;
  return `Review by ${review.reviewerName} is now ${review.visible ? "VISIBLE" : "HIDDEN"} on the website.`;
}

async function toolListSupplyPurchases(input: Record<string, unknown>) {
  const limit = Math.min(Number(input.limit ?? 20), 100);
  const purchases = await getAllPurchases();
  const sorted = purchases
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    .slice(0, limit);

  if (sorted.length === 0) return "No supply purchases recorded.";

  const lines = sorted.map((p) => {
    const total = `$${(p.totalCents / 100).toFixed(2)}`;
    const itemCount = p.items.length;
    const itemSummary = p.items
      .slice(0, 3)
      .map((i) => i.name)
      .join(", ");
    return `• ${p.purchaseDate} — ${p.vendorName} — ${total} (${itemCount} item${itemCount !== 1 ? "s" : ""})\n  ${itemSummary}${itemCount > 3 ? ` +${itemCount - 3} more` : ""}`;
  });

  const totalSpend = purchases.reduce((sum, p) => sum + p.totalCents, 0);
  return [
    `${sorted.length} purchases shown (${purchases.length} total, $${(totalSpend / 100).toFixed(2)} all-time):`,
    "",
    ...lines,
  ].join("\n");
}

async function toolGetActivityLogs(input: Record<string, unknown>) {
  const limit = Math.min(Number(input.limit ?? 30), 100);
  const logs = await getAdminLogs(limit);

  if (logs.length === 0) return "No activity logs found.";

  const lines = logs.map((l) => {
    const time = new Date(l.timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const status = l.success ? "✓" : "✗";
    return `${status} [${time}] ${l.action}${l.adminEmail ? ` by ${l.adminEmail}` : ""}`;
  });

  return `${logs.length} recent actions:\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// MCP protocol handler
// ---------------------------------------------------------------------------

async function handleMcp(body: Record<string, unknown>): Promise<unknown> {
  const { method, params, id } = body as {
    method: string;
    params?: Record<string, unknown>;
    id?: unknown;
  };

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "desert-candle-works", version: "2.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const toolName = String(params?.name ?? "");
    const toolInput = (params?.arguments ?? {}) as Record<string, unknown>;

    let text: string;
    try {
      switch (toolName) {
        case "list_products":
          text = await toolListProducts(toolInput);
          break;
        case "get_product":
          text = await toolGetProduct(toolInput);
          break;
        case "update_stock":
          text = await toolUpdateStock(toolInput);
          break;
        case "get_inventory_summary":
          text = await toolGetInventorySummary();
          break;
        case "list_orders":
          text = await toolListOrders(toolInput);
          break;
        case "get_order":
          text = await toolGetOrder(toolInput);
          break;
        case "mark_order_shipped":
          text = await toolMarkOrderShipped(toolInput);
          break;
        case "record_manual_sale":
          text = await toolRecordManualSale(toolInput);
          break;
        case "get_revenue_summary":
          text = await toolGetRevenueSummary(toolInput);
          break;
        case "list_customers":
          text = await toolListCustomers();
          break;
        case "list_scents":
          text = await toolListScents();
          break;
        case "list_promotions":
          text = await toolListPromotions(toolInput);
          break;
        case "toggle_promotion":
          text = await toolTogglePromotion(toolInput);
          break;
        case "list_reviews":
          text = await toolListReviews(toolInput);
          break;
        case "add_review":
          text = await toolAddReview(toolInput);
          break;
        case "toggle_review_visibility":
          text = await toolToggleReviewVisibility(toolInput);
          break;
        case "list_supply_purchases":
          text = await toolListSupplyPurchases(toolInput);
          break;
        case "get_activity_logs":
          text = await toolGetActivityLogs(toolInput);
          break;
        default:
          text = `Unknown tool: ${toolName}`;
      }
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: String(err) },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text }] },
    };
  }

  // Unknown method — return empty result
  return { jsonrpc: "2.0", id, result: {} };
}

// ---------------------------------------------------------------------------
// CORS headers (required for Claude.ai browser-based MCP requests)
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

// Preflight handler — Claude.ai sends this before every POST
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isAuthorized(token)) {
    return new NextResponse("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (String(body.method ?? "") === "notifications/initialized") {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }

  const result = await handleMcp(body);
  return NextResponse.json(result, { headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isAuthorized(token)) {
    return new NextResponse("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      name: "desert-candle-works",
      description: "Desert Candle Works admin tools for Claude",
      version: "2.0.0",
      tools: TOOLS.map((t) => t.name),
    },
    { headers: CORS_HEADERS }
  );
}
