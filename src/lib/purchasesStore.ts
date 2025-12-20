// Purchases management using Postgres
import { db } from "./db/client";
import { purchases, purchaseItems } from "./db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import crypto from "crypto";

export type PurchaseItem = {
  name: string;
  quantity: number;
  unitCostCents: number;
  category: string;
  notes?: string;
};

export type Purchase = {
  id: string;
  vendorName: string;
  purchaseDate: string;
  items: PurchaseItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  receiptImageUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseItemWithAllocations = PurchaseItem & {
  totalCostCents: number;
  allocatedShippingCents: number;
  allocatedTaxCents: number;
  fullyLoadedCostCents: number;
  costPerUnitCents: number;
};

export function calculateItemAllocations(
  items: PurchaseItem[],
  shippingCents: number,
  taxCents: number
): PurchaseItemWithAllocations[] {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCostCents,
    0
  );

  if (subtotalCents === 0) {
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

  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCostCents,
    0
  );

  const totalCents = subtotalCents + shippingCents + taxCents;

  await db.transaction(async (tx) => {
    await tx.insert(purchases).values({
      id,
      vendorName,
      purchaseDate,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      receiptImageUrl: receiptImageUrl || null,
      notes: notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const item of items) {
      await tx.insert(purchaseItems).values({
        purchaseId: id,
        name: item.name,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        category: item.category,
        notes: item.notes || null,
        createdAt: new Date(),
      });
    }
  });

  return {
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
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, id))
    .limit(1);

  if (!purchase) return null;

  const items = await db
    .select()
    .from(purchaseItems)
    .where(eq(purchaseItems.purchaseId, id));

  return {
    id: purchase.id,
    vendorName: purchase.vendorName,
    purchaseDate: purchase.purchaseDate,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitCostCents: item.unitCostCents,
      category: item.category,
      notes: item.notes || undefined,
    })),
    subtotalCents: purchase.subtotalCents,
    shippingCents: purchase.shippingCents,
    taxCents: purchase.taxCents,
    totalCents: purchase.totalCents,
    receiptImageUrl: purchase.receiptImageUrl || undefined,
    notes: purchase.notes || undefined,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}

export async function getAllPurchases(): Promise<Purchase[]> {
  const allPurchases = await db
    .select()
    .from(purchases)
    .orderBy(desc(purchases.purchaseDate));

  const result: Purchase[] = [];

  for (const purchase of allPurchases) {
    const items = await db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseId, purchase.id));

    result.push({
      id: purchase.id,
      vendorName: purchase.vendorName,
      purchaseDate: purchase.purchaseDate,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        category: item.category,
        notes: item.notes || undefined,
      })),
      subtotalCents: purchase.subtotalCents,
      shippingCents: purchase.shippingCents,
      taxCents: purchase.taxCents,
      totalCents: purchase.totalCents,
      receiptImageUrl: purchase.receiptImageUrl || undefined,
      notes: purchase.notes || undefined,
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
    });
  }

  return result;
}

export async function getPurchasesByVendor(vendorName: string): Promise<Purchase[]> {
  const allPurchases = await getAllPurchases();
  return allPurchases.filter(
    (p) => p.vendorName.toLowerCase() === vendorName.toLowerCase()
  );
}

export async function getPurchasesByDateRange(
  startDate: string,
  endDate: string
): Promise<Purchase[]> {
  const allPurchases = await db
    .select()
    .from(purchases)
    .where(
      and(
        gte(purchases.purchaseDate, startDate),
        lte(purchases.purchaseDate, endDate)
      )
    )
    .orderBy(desc(purchases.purchaseDate));

  const result: Purchase[] = [];

  for (const purchase of allPurchases) {
    const items = await db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseId, purchase.id));

    result.push({
      id: purchase.id,
      vendorName: purchase.vendorName,
      purchaseDate: purchase.purchaseDate,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        category: item.category,
        notes: item.notes || undefined,
      })),
      subtotalCents: purchase.subtotalCents,
      shippingCents: purchase.shippingCents,
      taxCents: purchase.taxCents,
      totalCents: purchase.totalCents,
      receiptImageUrl: purchase.receiptImageUrl || undefined,
      notes: purchase.notes || undefined,
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
    });
  }

  return result;
}

export async function updatePurchase(
  id: string,
  updates: Partial<Omit<Purchase, "id" | "createdAt">>
): Promise<Purchase | null> {
  const existing = await getPurchaseById(id);
  if (!existing) return null;

  await db.transaction(async (tx) => {
    const setValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.vendorName !== undefined) setValues.vendorName = updates.vendorName;
    if (updates.purchaseDate !== undefined) setValues.purchaseDate = updates.purchaseDate;
    if (updates.subtotalCents !== undefined) setValues.subtotalCents = updates.subtotalCents;
    if (updates.shippingCents !== undefined) setValues.shippingCents = updates.shippingCents;
    if (updates.taxCents !== undefined) setValues.taxCents = updates.taxCents;
    if (updates.totalCents !== undefined) setValues.totalCents = updates.totalCents;
    if (updates.receiptImageUrl !== undefined) setValues.receiptImageUrl = updates.receiptImageUrl || null;
    if (updates.notes !== undefined) setValues.notes = updates.notes || null;

    await tx.update(purchases).set(setValues).where(eq(purchases.id, id));

    if (updates.items) {
      await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId, id));

      for (const item of updates.items) {
        await tx.insert(purchaseItems).values({
          purchaseId: id,
          name: item.name,
          quantity: item.quantity,
          unitCostCents: item.unitCostCents,
          category: item.category,
          notes: item.notes || null,
          createdAt: new Date(),
        });
      }
    }
  });

  return await getPurchaseById(id);
}

export async function deletePurchase(id: string): Promise<void> {
  await db.delete(purchases).where(eq(purchases.id, id));
}

export async function getSpendingByCategory(): Promise<Record<string, number>> {
  const allPurchases = await getAllPurchases();
  const spending: Record<string, number> = {};

  for (const purchase of allPurchases) {
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

export async function getSpendingByVendor(): Promise<Record<string, number>> {
  const allPurchases = await getAllPurchases();
  const spending: Record<string, number> = {};

  for (const purchase of allPurchases) {
    spending[purchase.vendorName] = (spending[purchase.vendorName] || 0) + purchase.totalCents;
  }

  return spending;
}

export async function getVendors(): Promise<string[]> {
  const allPurchases = await getAllPurchases();
  const vendors = new Set<string>();

  for (const purchase of allPurchases) {
    vendors.add(purchase.vendorName);
  }

  return Array.from(vendors).sort();
}
