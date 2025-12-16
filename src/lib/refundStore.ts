// Refund management using Vercel KV (Redis)
import { kv } from "@vercel/kv";

export type RefundReason =
  | "customer_request"
  | "damaged_product"
  | "wrong_item_sent"
  | "quality_issue"
  | "shipping_delay"
  | "duplicate_order"
  | "other";

export type RefundStatus = "pending" | "processing" | "completed" | "failed";

export type Refund = {
  id: string; // UUID
  orderId: string; // Stripe checkout session ID
  stripeRefundId?: string; // Stripe refund ID (set after processing)
  email: string; // Customer email
  userId?: string; // Optional - null for guest orders
  amountCents: number; // Refund amount in cents
  reason: RefundReason;
  reasonNote?: string; // Additional details from admin
  status: RefundStatus;
  restoreInventory: boolean; // Whether to restore stock
  pointsToDeduct?: number; // Points to remove if order earned points
  processedBy?: string; // Admin user ID who processed it
  createdAt: string; // ISO timestamp
  processedAt?: string; // ISO timestamp when completed
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    variantId?: string; // For variant products
    refundAmountCents: number; // Refund amount for this item
  }>;
};

const REFUND_KEY = (id: string) => `refund:${id}`;
const REFUNDS_INDEX = "refunds:index";
const ORDER_REFUNDS_KEY = (orderId: string) => `order:${orderId}:refunds`;

/**
 * Create a new refund record
 */
export async function createRefund(refund: Refund): Promise<Refund> {
  await kv.set(REFUND_KEY(refund.id), refund);
  await kv.sadd(REFUNDS_INDEX, refund.id);

  // Index by order ID for quick lookups
  await kv.sadd(ORDER_REFUNDS_KEY(refund.orderId), refund.id);

  return refund;
}

/**
 * Get a refund by ID
 */
export async function getRefundById(id: string): Promise<Refund | null> {
  const refund = await kv.get<Refund>(REFUND_KEY(id));
  return refund || null;
}

/**
 * Update refund status
 */
export async function updateRefundStatus(
  id: string,
  status: RefundStatus,
  stripeRefundId?: string,
  processedAt?: string
): Promise<Refund | null> {
  const refund = await getRefundById(id);
  if (!refund) return null;

  refund.status = status;
  if (stripeRefundId) refund.stripeRefundId = stripeRefundId;
  if (processedAt) refund.processedAt = processedAt;

  await kv.set(REFUND_KEY(id), refund);
  return refund;
}

/**
 * List all refunds
 */
export async function listRefunds(): Promise<Refund[]> {
  const ids = await kv.smembers(REFUNDS_INDEX);
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const keys = ids.map((id: string) => REFUND_KEY(id));
  const refunds = await kv.mget<Refund[]>(...keys);

  return refunds
    .filter((r): r is Refund => Boolean(r))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get refunds for a specific order
 */
export async function getRefundsByOrderId(orderId: string): Promise<Refund[]> {
  const refundIds = await kv.smembers(ORDER_REFUNDS_KEY(orderId));
  if (!Array.isArray(refundIds) || refundIds.length === 0) return [];

  const keys = refundIds.map((id: string) => REFUND_KEY(id));
  const refunds = await kv.mget<Refund[]>(...keys);

  return refunds
    .filter((r): r is Refund => Boolean(r))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Check if an order has been fully or partially refunded
 */
export async function getOrderRefundTotal(orderId: string): Promise<number> {
  const refunds = await getRefundsByOrderId(orderId);
  return refunds
    .filter(r => r.status === "completed")
    .reduce((total, r) => total + r.amountCents, 0);
}
