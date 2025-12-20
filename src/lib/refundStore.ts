// Refund management using Postgres
import { db } from "./db/client";
import { refunds, refundItems } from "./db/schema";
import { eq, desc } from "drizzle-orm";

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
  id: string;
  orderId: string;
  stripeRefundId?: string;
  email: string;
  userId?: string;
  amountCents: number;
  reason: RefundReason;
  reasonNote?: string;
  status: RefundStatus;
  restoreInventory: boolean;
  pointsToDeduct?: number;
  processedBy?: string;
  createdAt: string;
  processedAt?: string;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    variantId?: string;
    refundAmountCents: number;
  }>;
};

export async function createRefund(refund: Refund): Promise<Refund> {
  await db.transaction(async (tx) => {
    await tx.insert(refunds).values({
      id: refund.id,
      orderId: refund.orderId,
      stripeRefundId: refund.stripeRefundId || null,
      userId: refund.userId || null,
      email: refund.email,
      amountCents: refund.amountCents,
      reason: refund.reason,
      reasonNote: refund.reasonNote || null,
      status: refund.status,
      restoreInventory: refund.restoreInventory,
      pointsToDeduct: refund.pointsToDeduct || 0,
      processedBy: refund.processedBy || null,
      createdAt: new Date(refund.createdAt),
      processedAt: refund.processedAt ? new Date(refund.processedAt) : null,
    });

    for (const item of refund.items) {
      await tx.insert(refundItems).values({
        refundId: refund.id,
        productSlug: item.productSlug,
        productName: item.productName,
        variantId: item.variantId || null,
        quantity: item.quantity,
        refundAmountCents: item.refundAmountCents,
      });
    }
  });

  return refund;
}

export async function getRefundById(id: string): Promise<Refund | null> {
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, id))
    .limit(1);

  if (!refund) return null;

  const items = await db
    .select()
    .from(refundItems)
    .where(eq(refundItems.refundId, id));

  return {
    id: refund.id,
    orderId: refund.orderId,
    stripeRefundId: refund.stripeRefundId || undefined,
    userId: refund.userId || undefined,
    email: refund.email,
    amountCents: refund.amountCents,
    reason: refund.reason,
    reasonNote: refund.reasonNote || undefined,
    status: refund.status,
    restoreInventory: refund.restoreInventory,
    pointsToDeduct: refund.pointsToDeduct || undefined,
    processedBy: refund.processedBy || undefined,
    createdAt: refund.createdAt.toISOString(),
    processedAt: refund.processedAt?.toISOString(),
    items: items.map((item) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
      refundAmountCents: item.refundAmountCents,
    })),
  };
}

export async function updateRefundStatus(
  id: string,
  status: RefundStatus,
  stripeRefundId?: string,
  processedAt?: string
): Promise<Refund | null> {
  const refund = await getRefundById(id);
  if (!refund) return null;

  const updateValues: Record<string, unknown> = { status };

  if (stripeRefundId) updateValues.stripeRefundId = stripeRefundId;
  if (processedAt) updateValues.processedAt = new Date(processedAt);

  await db.update(refunds).set(updateValues).where(eq(refunds.id, id));

  return await getRefundById(id);
}

export async function listRefunds(): Promise<Refund[]> {
  const allRefunds = await db
    .select()
    .from(refunds)
    .orderBy(desc(refunds.createdAt));

  const result: Refund[] = [];

  for (const refund of allRefunds) {
    const items = await db
      .select()
      .from(refundItems)
      .where(eq(refundItems.refundId, refund.id));

    result.push({
      id: refund.id,
      orderId: refund.orderId,
      stripeRefundId: refund.stripeRefundId || undefined,
      userId: refund.userId || undefined,
      email: refund.email,
      amountCents: refund.amountCents,
      reason: refund.reason,
      reasonNote: refund.reasonNote || undefined,
      status: refund.status,
      restoreInventory: refund.restoreInventory,
      pointsToDeduct: refund.pointsToDeduct || undefined,
      processedBy: refund.processedBy || undefined,
      createdAt: refund.createdAt.toISOString(),
      processedAt: refund.processedAt?.toISOString(),
      items: items.map((item) => ({
        productSlug: item.productSlug,
        productName: item.productName,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
        refundAmountCents: item.refundAmountCents,
      })),
    });
  }

  return result;
}

export async function getRefundsByOrderId(orderId: string): Promise<Refund[]> {
  const orderRefunds = await db
    .select()
    .from(refunds)
    .where(eq(refunds.orderId, orderId))
    .orderBy(desc(refunds.createdAt));

  const result: Refund[] = [];

  for (const refund of orderRefunds) {
    const items = await db
      .select()
      .from(refundItems)
      .where(eq(refundItems.refundId, refund.id));

    result.push({
      id: refund.id,
      orderId: refund.orderId,
      stripeRefundId: refund.stripeRefundId || undefined,
      userId: refund.userId || undefined,
      email: refund.email,
      amountCents: refund.amountCents,
      reason: refund.reason,
      reasonNote: refund.reasonNote || undefined,
      status: refund.status,
      restoreInventory: refund.restoreInventory,
      pointsToDeduct: refund.pointsToDeduct || undefined,
      processedBy: refund.processedBy || undefined,
      createdAt: refund.createdAt.toISOString(),
      processedAt: refund.processedAt?.toISOString(),
      items: items.map((item) => ({
        productSlug: item.productSlug,
        productName: item.productName,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
        refundAmountCents: item.refundAmountCents,
      })),
    });
  }

  return result;
}

export async function getOrderRefundTotal(orderId: string): Promise<number> {
  const orderRefunds = await getRefundsByOrderId(orderId);
  return orderRefunds
    .filter((r) => r.status === "completed")
    .reduce((total, r) => total + r.amountCents, 0);
}
