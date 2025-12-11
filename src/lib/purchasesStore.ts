import { kv } from "@vercel/kv";
import crypto from "crypto";

export type PurchaseItem = {
  name: string;
  quantity: number;
  unitCostCents: number; // Cost per unit before shipping/tax
  category: string; // "wax", "wicks", "bottles", "scents", "labels", "packaging", "equipment", "other"
  notes?: string;
};

export type Purchase = {
  id: string; // UUID
  vendorName: string;
  purchaseDate: string; // ISO date (YYYY-MM-DD)
  items: PurchaseItem[];
  subtotalCents: number; // Sum of all items (quantity * unitCost)
  shippingCents: number; // Total shipping cost
  taxCents: number; // Total tax
  totalCents: number; // subtotal + shipping + tax
  receiptImageUrl?: string; // Vercel Blob URL
  notes?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};

export type PurchaseItemWithAllocations = PurchaseItem & {
  totalCostCents: number; // quantity * unitCost
  allocatedShippingCents: number; // Proportional share of shipping
  allocatedTaxCents: number; // Proportional share of tax
  fullyLoadedCostCents: number; // totalCost + allocatedShipping + allocatedTax
  costPerUnitCents: number; // fullyLoadedCost / quantity
};

/**
 * Calculate allocated shipping and tax for each item in a purchase
 * Shipping and tax are allocated proportionally based on item cost
 */
export function calculateItemAllocations(
  items: PurchaseItem[],
  shippingCents: number,
  taxCents: number
): PurchaseItemWithAllocations[] {
  // Calculate subtotal
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCostCents,
    0
  );

  if (subtotalCents === 0) {
    // Avoid division by zero - return items with zero allocations
    return items.map((item) => ({
      ...item,
      totalCostCents: 0,
      allocatedShippingCents: 0,
      allocatedTaxCents: 0,
      fullyLoadedCostCents: 0,
      costPerUnitCents: 0,
    }));
  }

  return items.map((item) => {
    const itemCostCents = item.quantity * item.unitCostCents;
    const costRatio = itemCostCents / subtotalCents;

    // Allocate shipping and tax proportionally
    const allocatedShippingCents = Math.round(shippingCents * costRatio);
    const allocatedTaxCents = Math.round(taxCents * costRatio);

    const fullyLoadedCostCents = itemCostCents + allocatedShippingCents + allocatedTaxCents;
    const costPerUnitCents = item.quantity > 0 ? Math.round(fullyLoadedCostCents / item.quantity) : 0;

    return {
      ...item,
      totalCostCents: itemCostCents,
      allocatedShippingCents,
      allocatedTaxCents,
      fullyLoadedCostCents,
      costPerUnitCents,
    };
  });
}

/**
 * Create a new purchase
 */
export async function createPurchase(
  vendorName: string,
  purchaseDate: string,
  items: PurchaseItem[],
  shippingCents: number,
  taxCents: number,
  receiptImageUrl?: string,
  notes?: string
): Promise<Purchase> {
  const id = crypto.randomUUID();

  // Calculate subtotal
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCostCents,
    0
  );

  const totalCents = subtotalCents + shippingCents + taxCents;

  const purchase: Purchase = {
    id,
    vendorName,
    purchaseDate,
    items,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    receiptImageUrl,
    notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store purchase
  await kv.set(`purchase:${id}`, purchase);

  // Add to index
  await kv.sadd("purchases:index", id);

  // Index by vendor for filtering
  await kv.sadd(`purchases:vendor:${vendorName.toLowerCase()}`, id);

  // Index by date (year-month) for analytics
  const yearMonth = purchaseDate.substring(0, 7); // YYYY-MM
  await kv.sadd(`purchases:date:${yearMonth}`, id);

  return purchase;
}

/**
 * Get a purchase by ID
 */
export async function getPurchaseById(id: string): Promise<Purchase | null> {
  return await kv.get<Purchase>(`purchase:${id}`);
}

/**
 * Get all purchases
 */
export async function getAllPurchases(): Promise<Purchase[]> {
  const ids = await kv.smembers("purchases:index");
  if (!ids || ids.length === 0) return [];

  const purchases = await Promise.all(
    ids.map((id) => kv.get<Purchase>(`purchase:${id}`))
  );

  return purchases
    .filter((p): p is Purchase => p !== null)
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
}

/**
 * Get purchases by vendor
 */
export async function getPurchasesByVendor(vendorName: string): Promise<Purchase[]> {
  const ids = await kv.smembers(`purchases:vendor:${vendorName.toLowerCase()}`);
  if (!ids || ids.length === 0) return [];

  const purchases = await Promise.all(
    ids.map((id) => kv.get<Purchase>(`purchase:${id}`))
  );

  return purchases
    .filter((p): p is Purchase => p !== null)
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
}

/**
 * Get purchases by date range
 */
export async function getPurchasesByDateRange(
  startDate: string,
  endDate: string
): Promise<Purchase[]> {
  const allPurchases = await getAllPurchases();

  return allPurchases.filter((p) => {
    return p.purchaseDate >= startDate && p.purchaseDate <= endDate;
  });
}

/**
 * Update a purchase
 */
export async function updatePurchase(
  id: string,
  updates: Partial<Omit<Purchase, "id" | "createdAt">>
): Promise<Purchase | null> {
  const existing = await getPurchaseById(id);
  if (!existing) return null;

  // Recalculate totals if items or costs changed
  let subtotalCents = existing.subtotalCents;
  let totalCents = existing.totalCents;

  if (updates.items) {
    subtotalCents = updates.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCostCents,
      0
    );
  }

  const shippingCents = updates.shippingCents ?? existing.shippingCents;
  const taxCents = updates.taxCents ?? existing.taxCents;
  totalCents = subtotalCents + shippingCents + taxCents;

  const updated: Purchase = {
    ...existing,
    ...updates,
    subtotalCents,
    totalCents,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`purchase:${id}`, updated);

  // Update vendor index if vendor changed
  if (updates.vendorName && updates.vendorName !== existing.vendorName) {
    await kv.srem(`purchases:vendor:${existing.vendorName.toLowerCase()}`, id);
    await kv.sadd(`purchases:vendor:${updates.vendorName.toLowerCase()}`, id);
  }

  // Update date index if date changed
  if (updates.purchaseDate && updates.purchaseDate !== existing.purchaseDate) {
    const oldYearMonth = existing.purchaseDate.substring(0, 7);
    const newYearMonth = updates.purchaseDate.substring(0, 7);
    await kv.srem(`purchases:date:${oldYearMonth}`, id);
    await kv.sadd(`purchases:date:${newYearMonth}`, id);
  }

  return updated;
}

/**
 * Delete a purchase
 */
export async function deletePurchase(id: string): Promise<boolean> {
  const purchase = await getPurchaseById(id);
  if (!purchase) return false;

  // Remove from indexes
  await kv.srem("purchases:index", id);
  await kv.srem(`purchases:vendor:${purchase.vendorName.toLowerCase()}`, id);
  const yearMonth = purchase.purchaseDate.substring(0, 7);
  await kv.srem(`purchases:date:${yearMonth}`, id);

  // Delete the purchase
  await kv.del(`purchase:${id}`);

  return true;
}

/**
 * Get total spending by category
 */
export async function getSpendingByCategory(): Promise<Record<string, number>> {
  const purchases = await getAllPurchases();
  const spending: Record<string, number> = {};

  for (const purchase of purchases) {
    const allocations = calculateItemAllocations(
      purchase.items,
      purchase.shippingCents,
      purchase.taxCents
    );

    for (const item of allocations) {
      const category = item.category || "other";
      spending[category] = (spending[category] || 0) + item.fullyLoadedCostCents;
    }
  }

  return spending;
}

/**
 * Get total spending by vendor
 */
export async function getSpendingByVendor(): Promise<Record<string, number>> {
  const purchases = await getAllPurchases();
  const spending: Record<string, number> = {};

  for (const purchase of purchases) {
    spending[purchase.vendorName] = (spending[purchase.vendorName] || 0) + purchase.totalCents;
  }

  return spending;
}

/**
 * Get unique vendors
 */
export async function getVendors(): Promise<string[]> {
  const purchases = await getAllPurchases();
  const vendors = new Set<string>();

  for (const purchase of purchases) {
    vendors.add(purchase.vendorName);
  }

  return Array.from(vendors).sort();
}
