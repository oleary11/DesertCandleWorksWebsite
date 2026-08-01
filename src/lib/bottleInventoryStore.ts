// Raw bottle inventory management using Postgres.
//
// This is the shared pool of physical bottles (by cutting/polishing stage)
// that Home Goods listings (non-candle products) draw from. It is separate
// from candle `products` rows: a candle bottle is already cut *and poured*
// (finished), so it can never become raw material for a different good.
//
// "Cut Poured" is not stored here — for a row linked to a candle product
// (via name match on sync), it's a live read of that product's current
// stock, so it can never drift from what the candle admin UI already shows.
//
// A single candle product can have multiple bottle SIZES (e.g. a 750mL and
// a 1L Grey Goose are physically different bottles), so one candle product
// can map to more than one inventory row — one per size — each with its own
// live stock read scoped to just that size's variants.
import { db } from "./db/client";
import { bottleInventory } from "./db/schema";
import { eq } from "drizzle-orm";
import { listResolvedProducts } from "./resolvedProducts";
import { getTotalStock, upsertProduct, type Product } from "./productsStore";

export const BOTTLE_INVENTORY_TAG = "bottle-inventory";

export type BottleInventoryItem = {
  id: string;
  name: string;
  qtyUncut: number;
  qtyCutUnpolished: number;
  qtyCutPolished: number;
  qtyCutPoured: number; // computed, read-only — see module comment
  defaultPriceCents?: number;
  capacityWaterOz?: number;
  containerShape?: string;
  containerCostPerUnitCents?: number;
  containerSupplier?: string;
  containerNotes?: string;
  imageUrl?: string; // shown in the Home Goods bottle picker (admin + storefront)
  alcoholType?: string; // groups the Home Goods bottle picker into sections, same convention as products.alcoholType
  linkedCandleProductSlug?: string;
  linkedSizeId?: string;
  usableForHomeGoods: boolean; // when false, excluded from every Home Goods listing's bottle checklist
  archived: boolean;
};

export type UnmatchedCandle = { slug: string; name: string };

type CandleBottleEntry = { name: string; sizeId?: string };

export type NewBottleCounts = {
  qtyUncut?: number;
  qtyCutUnpolished?: number;
  qtyCutPolished?: number;
  capacityWaterOz?: number;
};

function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** "Grey Goose Vodka Candle" -> "Grey Goose Vodka"; keeps names whose optional "Candle" suffix is absent. */
function deriveBottleNameFromCandle(productName: string): string | null {
  const name = productName.replace(/\s+candle$/i, "").trim();
  return name.length > 0 ? name : null;
}

/**
 * One entry per distinct physical bottle for this candle product: if it has
 * more than one size configured, each size gets its own name + sizeId (they
 * are different bottles); otherwise a single unsized entry. The optional display-name
 * suffix "Candle" is removed when present.
 */
function getBottleEntriesForCandle(product: Product): CandleBottleEntry[] | null {
  const base = deriveBottleNameFromCandle(product.name);
  if (!base) return null;

  const sizes = product.variantConfig?.sizes;
  if (sizes && sizes.length > 1) {
    return sizes.map((s) => ({ name: `${base} (${s.ozs} oz)`, sizeId: s.id }));
  }
  return [{ name: base }];
}

/** Sum stock only for variants belonging to a specific size (variantId format: `${sizeId}-${wickId}-${scentId}`) */
function getStockForSize(product: Product, sizeId: string): number {
  const variantData = product.variantConfig?.variantData ?? {};
  let total = 0;
  for (const [key, data] of Object.entries(variantData)) {
    if (key.startsWith(`${sizeId}-`)) total += data.stock ?? 0;
  }
  return total;
}

function assignBottleToProduct(product: Product, bottleId: string, sizeId?: string): Product {
  if (!sizeId) {
    return product.containerId === bottleId ? product : { ...product, containerId: bottleId };
  }
  const sizes = product.variantConfig?.sizes;
  if (!sizes) return product;
  const size = sizes.find((candidate) => candidate.id === sizeId);
  if (!size || size.containerId === bottleId) return product;
  return {
    ...product,
    variantConfig: {
      ...product.variantConfig!,
      sizes: sizes.map((candidate) => candidate.id === sizeId ? { ...candidate, containerId: bottleId } : candidate),
    },
  };
}
function pouredKey(slug: string, sizeId?: string): string {
  return `${slug}::${sizeId ?? ""}`;
}

function bottlePouredKey(bottleId: string): string {
  return `bottle::${bottleId}`;
}

function addPouredCount(map: Map<string, number>, key: string, count: number): void {
  map.set(key, (map.get(key) ?? 0) + count);
}

async function getPouredCounts(): Promise<Map<string, number>> {
  const products = await listResolvedProducts();
  const map = new Map<string, number>();
  for (const p of products) {
    if (p.productType === "home_goods") continue;
    const sizes = p.variantConfig?.sizes;
    if (sizes && sizes.length > 1) {
      for (const size of sizes) {
        const count = getStockForSize(p, size.id);
        map.set(pouredKey(p.slug, size.id), count); // legacy sync link
        const bottleId = size.containerId ?? p.containerId;
        if (bottleId) addPouredCount(map, bottlePouredKey(bottleId), count);
      }
    } else {
      const count = getTotalStock(p);
      map.set(pouredKey(p.slug), count); // legacy sync link
      const bottleId = sizes?.[0]?.containerId ?? p.containerId;
      if (bottleId) addPouredCount(map, bottlePouredKey(bottleId), count);
    }
  }
  return map;
}

export async function getAllBottleInventory(): Promise<BottleInventoryItem[]> {
  const [rows, pouredByKey] = await Promise.all([
    db.select().from(bottleInventory),
    getPouredCounts(),
  ]);

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      qtyUncut: r.qtyUncut,
      qtyCutUnpolished: r.qtyCutUnpolished,
      qtyCutPolished: r.qtyCutPolished,
      qtyCutPoured: pouredByKey.get(bottlePouredKey(r.id))
        ?? (r.linkedCandleProductSlug
          ? pouredByKey.get(pouredKey(r.linkedCandleProductSlug, r.linkedSizeId ?? undefined)) ?? 0
          : 0),
      defaultPriceCents: r.defaultPriceCents ?? undefined,
      capacityWaterOz: r.capacityWaterOz ?? undefined,
      containerShape: r.containerShape ?? undefined,
      containerCostPerUnitCents: r.containerCostPerUnitCents ?? undefined,
      containerSupplier: r.containerSupplier ?? undefined,
      containerNotes: r.containerNotes ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      alcoholType: r.alcoholType ?? undefined,
      linkedCandleProductSlug: r.linkedCandleProductSlug ?? undefined,
      linkedSizeId: r.linkedSizeId ?? undefined,
      usableForHomeGoods: r.usableForHomeGoods,
      archived: r.archived,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A newly created bottle type should be immediately purchasable everywhere
 * it's eligible, not just in bottles added before a Home Goods listing was
 * configured — so add it to every existing Home Goods listing's bottleOptions
 * (at that listing's default price; no per-bottle override). Called once per
 * brand-new bottle_inventory row, from addBottleType and syncBottleInventoryFromCandles.
 */
async function addBottleToHomeGoodsListings(bottleId: string, bottleName: string): Promise<void> {
  const products = await listResolvedProducts();
  for (const product of products) {
    if (product.productType !== "home_goods") continue;
    if ((product.bottleOptions || []).some((o) => o.bottleId === bottleId)) continue;
    await upsertProduct({
      ...product,
      bottleOptions: [...(product.bottleOptions || []), { bottleId, bottleName }],
    });
  }
}

export async function addBottleType(
  name: string,
  defaultPriceCents?: number,
  counts: NewBottleCounts = {}
): Promise<BottleInventoryItem> {
  const trimmed = name.trim();
  const id = slugifyId(trimmed);
  const qtyUncut = Math.max(0, Math.floor(counts.qtyUncut ?? 0));
  const qtyCutUnpolished = Math.max(0, Math.floor(counts.qtyCutUnpolished ?? 0));
  const qtyCutPolished = Math.max(0, Math.floor(counts.qtyCutPolished ?? 0));
  const capacityWaterOz = counts.capacityWaterOz && counts.capacityWaterOz > 0 ? counts.capacityWaterOz : null;

  const [existing] = await db
    .select()
    .from(bottleInventory)
    .where(eq(bottleInventory.id, id))
    .limit(1);

  if (existing) {
    if (existing.archived) {
      await db
        .update(bottleInventory)
        .set({ archived: false, updatedAt: new Date() })
        .where(eq(bottleInventory.id, id));
    }
    return {
      id: existing.id,
      name: existing.name,
      qtyUncut: existing.qtyUncut,
      qtyCutUnpolished: existing.qtyCutUnpolished,
      qtyCutPolished: existing.qtyCutPolished,
      qtyCutPoured: (await getPouredCounts()).get(bottlePouredKey(existing.id)) ?? 0,
      defaultPriceCents: existing.defaultPriceCents ?? undefined,
      capacityWaterOz: existing.capacityWaterOz ?? undefined,
      containerShape: existing.containerShape ?? undefined,
      containerCostPerUnitCents: existing.containerCostPerUnitCents ?? undefined,
      containerSupplier: existing.containerSupplier ?? undefined,
      containerNotes: existing.containerNotes ?? undefined,
      imageUrl: existing.imageUrl ?? undefined,
      alcoholType: existing.alcoholType ?? undefined,
      linkedCandleProductSlug: existing.linkedCandleProductSlug ?? undefined,
      linkedSizeId: existing.linkedSizeId ?? undefined,
      usableForHomeGoods: existing.usableForHomeGoods,
      archived: false,
    };
  }

  await db.insert(bottleInventory).values({
    id,
    name: trimmed,
    qtyUncut,
    qtyCutUnpolished,
    qtyCutPolished,
    capacityWaterOz,
    defaultPriceCents: defaultPriceCents ?? null,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await addBottleToHomeGoodsListings(id, trimmed);

  return {
    id,
    name: trimmed,
    qtyUncut,
    qtyCutUnpolished,
    qtyCutPolished,
    qtyCutPoured: 0,
    capacityWaterOz: capacityWaterOz ?? undefined,
    defaultPriceCents,
    usableForHomeGoods: true,
    archived: false,
  };
}

export async function updateBottleType(
  id: string,
  patch: {
    name?: string;
    qtyUncut?: number;
    qtyCutUnpolished?: number;
    qtyCutPolished?: number;
    defaultPriceCents?: number | null;
    capacityWaterOz?: number | null;
    containerShape?: string | null;
    containerCostPerUnitCents?: number | null;
    containerSupplier?: string | null;
    containerNotes?: string | null;
    imageUrl?: string | null;
    alcoholType?: string | null;
    usableForHomeGoods?: boolean;
    archived?: boolean;
  }
): Promise<BottleInventoryItem | null> {
  const [found] = await db
    .select()
    .from(bottleInventory)
    .where(eq(bottleInventory.id, id))
    .limit(1);

  if (!found) return null;

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.name !== "undefined") updateValues.name = patch.name;
  if (typeof patch.qtyUncut !== "undefined") updateValues.qtyUncut = Math.max(0, Math.floor(patch.qtyUncut));
  if (typeof patch.qtyCutUnpolished !== "undefined") updateValues.qtyCutUnpolished = Math.max(0, Math.floor(patch.qtyCutUnpolished));
  if (typeof patch.qtyCutPolished !== "undefined") updateValues.qtyCutPolished = Math.max(0, Math.floor(patch.qtyCutPolished));
  if (typeof patch.defaultPriceCents !== "undefined") updateValues.defaultPriceCents = patch.defaultPriceCents;
  if (typeof patch.capacityWaterOz !== "undefined") updateValues.capacityWaterOz = patch.capacityWaterOz;
  if (typeof patch.containerShape !== "undefined") updateValues.containerShape = patch.containerShape;
  if (typeof patch.containerCostPerUnitCents !== "undefined") updateValues.containerCostPerUnitCents = patch.containerCostPerUnitCents;
  if (typeof patch.containerSupplier !== "undefined") updateValues.containerSupplier = patch.containerSupplier;
  if (typeof patch.containerNotes !== "undefined") updateValues.containerNotes = patch.containerNotes;
  if (typeof patch.imageUrl !== "undefined") updateValues.imageUrl = patch.imageUrl;
  if (typeof patch.alcoholType !== "undefined") updateValues.alcoholType = patch.alcoholType;
  if (typeof patch.usableForHomeGoods !== "undefined") updateValues.usableForHomeGoods = !!patch.usableForHomeGoods;
  if (typeof patch.archived !== "undefined") updateValues.archived = !!patch.archived;

  await db.update(bottleInventory).set(updateValues).where(eq(bottleInventory.id, id));

  const pouredByKey = await getPouredCounts();

  return {
    id: found.id,
    name: (patch.name ?? found.name) as string,
    qtyUncut: (updateValues.qtyUncut as number | undefined) ?? found.qtyUncut,
    qtyCutUnpolished: (updateValues.qtyCutUnpolished as number | undefined) ?? found.qtyCutUnpolished,
    qtyCutPolished: (updateValues.qtyCutPolished as number | undefined) ?? found.qtyCutPolished,
    qtyCutPoured: pouredByKey.get(bottlePouredKey(found.id))
      ?? (found.linkedCandleProductSlug
        ? pouredByKey.get(pouredKey(found.linkedCandleProductSlug, found.linkedSizeId ?? undefined)) ?? 0
        : 0),
    defaultPriceCents: (patch.defaultPriceCents ?? found.defaultPriceCents) ?? undefined,
    capacityWaterOz: (patch.capacityWaterOz ?? found.capacityWaterOz) ?? undefined,
    containerShape: (patch.containerShape ?? found.containerShape) ?? undefined,
    containerCostPerUnitCents: (patch.containerCostPerUnitCents ?? found.containerCostPerUnitCents) ?? undefined,
    containerSupplier: (patch.containerSupplier ?? found.containerSupplier) ?? undefined,
    containerNotes: (patch.containerNotes ?? found.containerNotes) ?? undefined,
    imageUrl: (patch.imageUrl !== undefined ? patch.imageUrl : found.imageUrl) ?? undefined,
    alcoholType: (patch.alcoholType !== undefined ? patch.alcoholType : found.alcoholType) ?? undefined,
    linkedCandleProductSlug: found.linkedCandleProductSlug ?? undefined,
    linkedSizeId: found.linkedSizeId ?? undefined,
    usableForHomeGoods: typeof patch.usableForHomeGoods !== "undefined" ? !!patch.usableForHomeGoods : found.usableForHomeGoods,
    archived: typeof patch.archived !== "undefined" ? !!patch.archived : found.archived,
  };
}

export async function updateBottleTypesMany(
  updates: Array<{
    id: string;
    name?: string;
    qtyUncut?: number;
    qtyCutUnpolished?: number;
    qtyCutPolished?: number;
    defaultPriceCents?: number | null;
    capacityWaterOz?: number | null;
    containerShape?: string | null;
    containerCostPerUnitCents?: number | null;
    containerSupplier?: string | null;
    containerNotes?: string | null;
    imageUrl?: string | null;
    alcoholType?: string | null;
    usableForHomeGoods?: boolean;
    archived?: boolean;
  }>
): Promise<void> {
  for (const u of updates) {
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof u.name !== "undefined") updateValues.name = u.name;
    if (typeof u.qtyUncut !== "undefined") updateValues.qtyUncut = Math.max(0, Math.floor(u.qtyUncut));
    if (typeof u.qtyCutUnpolished !== "undefined") updateValues.qtyCutUnpolished = Math.max(0, Math.floor(u.qtyCutUnpolished));
    if (typeof u.qtyCutPolished !== "undefined") updateValues.qtyCutPolished = Math.max(0, Math.floor(u.qtyCutPolished));
      if (typeof u.defaultPriceCents !== "undefined") updateValues.defaultPriceCents = u.defaultPriceCents;
    if (typeof u.capacityWaterOz !== "undefined") updateValues.capacityWaterOz = u.capacityWaterOz;
    if (typeof u.containerShape !== "undefined") updateValues.containerShape = u.containerShape;
    if (typeof u.containerCostPerUnitCents !== "undefined") updateValues.containerCostPerUnitCents = u.containerCostPerUnitCents;
    if (typeof u.containerSupplier !== "undefined") updateValues.containerSupplier = u.containerSupplier;
    if (typeof u.containerNotes !== "undefined") updateValues.containerNotes = u.containerNotes;
    if (typeof u.imageUrl !== "undefined") updateValues.imageUrl = u.imageUrl;
    if (typeof u.alcoholType !== "undefined") updateValues.alcoholType = u.alcoholType;
    if (typeof u.usableForHomeGoods !== "undefined") updateValues.usableForHomeGoods = !!u.usableForHomeGoods;
    if (typeof u.archived !== "undefined") updateValues.archived = !!u.archived;

    await db.update(bottleInventory).set(updateValues).where(eq(bottleInventory.id, u.id));
  }
}

export async function deleteBottleType(id: string): Promise<boolean> {
  const [found] = await db
    .select()
    .from(bottleInventory)
    .where(eq(bottleInventory.id, id))
    .limit(1);

  if (!found) return false;

  await db.delete(bottleInventory).where(eq(bottleInventory.id, id));
  return true;
}

/**
 * Scan all candle products and upsert a bottle-name row per distinct
 * physical bottle (one per size, when a product has more than one size),
 * linking each back to the source product (+ size) so "Cut Poured" can be
 * read live from that product's stock. Re-runnable — safe to call again
 * after adding new candle products or new sizes.
 */
export async function syncBottleInventoryFromCandles(): Promise<{
  created: string[];
  linked: string[];
  unmatched: UnmatchedCandle[];
}> {
  const products = await listResolvedProducts();
  const existingRows = await db.select().from(bottleInventory);
  const byName = new Map(existingRows.map((r) => [r.name.toLowerCase(), r]));
  const byLinkedKey = new Map(
    existingRows
      .filter((r) => r.linkedCandleProductSlug)
      .map((r) => [pouredKey(r.linkedCandleProductSlug!, r.linkedSizeId ?? undefined), r])
  );

  const created: string[] = [];
  const linked: string[] = [];
  const unmatched: UnmatchedCandle[] = [];

  for (const product of products) {
    if (product.productType === "home_goods") continue;

    let productWithLinks = product;
    const entries = getBottleEntriesForCandle(product);
    if (!entries) {
      unmatched.push({ slug: product.slug, name: product.name });
      continue;
    }

    for (const entry of entries) {
      const key = pouredKey(product.slug, entry.sizeId);
      const alreadyLinked = byLinkedKey.get(key);
      if (alreadyLinked) {
        productWithLinks = assignBottleToProduct(productWithLinks, alreadyLinked.id, entry.sizeId);
        // Already linked from a previous sync — just refresh its alcohol type
        // in case the candle's type changed (or this column didn't exist yet).
        if ((alreadyLinked.alcoholType ?? null) !== (product.alcoholType ?? null)) {
          await db
            .update(bottleInventory)
            .set({ alcoholType: product.alcoholType ?? null, updatedAt: new Date() })
            .where(eq(bottleInventory.id, alreadyLinked.id));
        }
        continue;
      }

      const existing = byName.get(entry.name.toLowerCase());
      if (existing) {
        productWithLinks = assignBottleToProduct(productWithLinks, existing.id, entry.sizeId);
        if (!existing.linkedCandleProductSlug) {
          await db
            .update(bottleInventory)
            .set({
              linkedCandleProductSlug: product.slug,
              linkedSizeId: entry.sizeId ?? null,
              alcoholType: product.alcoholType ?? null,
              updatedAt: new Date(),
            })
            .where(eq(bottleInventory.id, existing.id));
          linked.push(entry.name);
        }
        continue;
      }

      const id = slugifyId(entry.name);
      await db.insert(bottleInventory).values({
        id,
        name: entry.name,
        qtyUncut: 0,
        qtyCutUnpolished: 0,
        qtyCutPolished: 0,
        linkedCandleProductSlug: product.slug,
        linkedSizeId: entry.sizeId ?? null,
        alcoholType: product.alcoholType ?? null,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await addBottleToHomeGoodsListings(id, entry.name);
      created.push(entry.name);
      productWithLinks = assignBottleToProduct(productWithLinks, id, entry.sizeId);
      byName.set(entry.name.toLowerCase(), {
        id,
        name: entry.name,
        qtyUncut: 0,
        qtyCutUnpolished: 0,
        qtyCutPolished: 0,
        qtyCutPouredManual: 0,
        defaultPriceCents: null,
        capacityWaterOz: null,
        containerShape: null,
        containerCostPerUnitCents: null,
        containerSupplier: null,
        containerNotes: null,
        legacyContainerId: null,
        imageUrl: null,
        alcoholType: product.alcoholType ?? null,
        linkedCandleProductSlug: product.slug,
        linkedSizeId: entry.sizeId ?? null,
        usableForHomeGoods: true,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (productWithLinks !== product) {
      await upsertProduct(productWithLinks);
    }
  }

  return { created, linked, unmatched };
}

/**
 * Live "available stock" for a Home Goods listing: the sum, across its
 * bottleOptions, of each referenced bottle's stock in whichever states the
 * listing's requirement allows (requiresUncut: only qtyUncut; otherwise
 * qtyUncut + qtyCutUnpolished + qtyCutPolished — never qtyCutPoured, that's
 * candle-exclusive). Pass a Map built once from `getAllBottleInventory()` so
 * callers listing many products don't re-query the DB per product.
 */
export function computeHomeGoodsStock(
  product: Pick<Product, "bottleOptions" | "requiresUncut">,
  bottleById: Map<string, BottleInventoryItem>
): number {
  if (!product.bottleOptions || product.bottleOptions.length === 0) return 0;
  let total = 0;
  for (const opt of product.bottleOptions) {
    const b = bottleById.get(opt.bottleId);
    if (!b) continue;
    total += product.requiresUncut ? b.qtyUncut : b.qtyUncut + b.qtyCutUnpolished + b.qtyCutPolished;
  }
  return total;
}

/** Convenience: fetch the live bottle inventory as an id-keyed Map for computeHomeGoodsStock() */
export async function getBottleInventoryById(): Promise<Map<string, BottleInventoryItem>> {
  const items = await getAllBottleInventory();
  return new Map(items.map((b) => [b.id, b]));
}

/** Stock for ONE bottle, respecting the same requiresUncut rule as computeHomeGoodsStock — used at checkout to validate a single selected bottle option. */
export function getSingleBottleStock(bottle: BottleInventoryItem, requiresUncut?: boolean): number {
  return requiresUncut ? bottle.qtyUncut : bottle.qtyUncut + bottle.qtyCutUnpolished + bottle.qtyCutPolished;
}

/**
 * Decrement a bottle's stock after a Home Goods sale, most-finished-state
 * first (Cut Polished → Cut Unpolished → Uncut) so the more-worked bottles
 * are held back for listings that specifically need them. If requiresUncut,
 * only qtyUncut is ever touched (that's the only state that listing can use).
 * Wrapped in a transaction with row locking, same pattern as productsStore's incrStock.
 */
export async function decrementBottleStockForSale(
  bottleId: string,
  qty: number,
  requiresUncut?: boolean
): Promise<void> {
  const deltaNeeded = Math.floor(qty);
  if (deltaNeeded <= 0) return;

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(bottleInventory)
      .where(eq(bottleInventory.id, bottleId))
      .for("update");

    if (!row) throw new Error(`Bottle not found: ${bottleId}`);

    let remaining = deltaNeeded;
    let nextUncut = row.qtyUncut;
    let nextCutUnpolished = row.qtyCutUnpolished;
    let nextCutPolished = row.qtyCutPolished;

    if (requiresUncut) {
      if (nextUncut < remaining) throw new Error(`Insufficient uncut stock for bottle ${bottleId}`);
      nextUncut -= remaining;
    } else {
      const fromPolished = Math.min(nextCutPolished, remaining);
      nextCutPolished -= fromPolished;
      remaining -= fromPolished;

      const fromUnpolished = Math.min(nextCutUnpolished, remaining);
      nextCutUnpolished -= fromUnpolished;
      remaining -= fromUnpolished;

      const fromUncut = Math.min(nextUncut, remaining);
      nextUncut -= fromUncut;
      remaining -= fromUncut;

      if (remaining > 0) throw new Error(`Insufficient stock for bottle ${bottleId}`);
    }

    await tx
      .update(bottleInventory)
      .set({
        qtyUncut: nextUncut,
        qtyCutUnpolished: nextCutUnpolished,
        qtyCutPolished: nextCutPolished,
        updatedAt: new Date(),
      })
      .where(eq(bottleInventory.id, bottleId));
  });
}
