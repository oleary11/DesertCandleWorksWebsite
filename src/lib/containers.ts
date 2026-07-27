import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { bottleInventory } from "./db/schema";
import { redis } from "./redis";

const LEGACY_CONTAINERS_KEY = "containers";
const LEGACY_CONTAINERS_INDEX_KEY = "containers:index";

export interface Container {
  id: string;
  name: string;
  capacityWaterOz: number;
  shape: string;
  supplier?: string;
  costPerUnit: number;
  notes?: string;
  imageUrl?: string;
}

function toContainer(row: typeof bottleInventory.$inferSelect): Container {
  return {
    id: row.id,
    name: row.name,
    capacityWaterOz: row.capacityWaterOz ?? 0,
    shape: row.containerShape ?? "Bottle",
    supplier: row.containerSupplier ?? undefined,
    costPerUnit: (row.containerCostPerUnitCents ?? 0) / 100,
    notes: row.containerNotes ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
  };
}

/**
 * One-time, non-destructive compatibility import. Exact ID or exact
 * case-insensitive name matches enrich an existing bottle. Anything else is
 * inserted as a new zero-count bottle; fuzzy matches are never guessed.
 * Legacy Redis records are intentionally retained as a rollback backup.
 */
async function importLegacyContainers(): Promise<void> {
  try {
    const legacyIds = await redis.smembers(LEGACY_CONTAINERS_INDEX_KEY);
    if (!legacyIds?.length) return;

    const rows = await db.select().from(bottleInventory);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const byName = new Map(rows.map((row) => [row.name.trim().toLowerCase(), row]));
    const importedLegacyIds = new Set(rows.map((row) => row.legacyContainerId).filter(Boolean));

    for (const legacyId of legacyIds) {
      if (importedLegacyIds.has(legacyId)) continue;
      const legacy = await redis.get(`${LEGACY_CONTAINERS_KEY}:${legacyId}`) as Container | null;
      if (!legacy?.name) continue;

      const match = byId.get(legacyId) ?? byName.get(legacy.name.trim().toLowerCase());
      const details = {
        capacityWaterOz: Number(legacy.capacityWaterOz) || null,
        containerShape: legacy.shape || "Bottle",
        containerCostPerUnitCents: Math.max(0, Math.round(Number(legacy.costPerUnit || 0) * 100)),
        containerSupplier: legacy.supplier || null,
        containerNotes: legacy.notes || null,
        legacyContainerId: legacyId,
        updatedAt: new Date(),
      };

      if (match) {
        await db.update(bottleInventory).set(details).where(eq(bottleInventory.id, match.id));
        importedLegacyIds.add(legacyId);
        continue;
      }

      await db.insert(bottleInventory).values({
        id: legacyId,
        name: legacy.name.trim(),
        qtyUncut: 0,
        qtyCutUnpolished: 0,
        qtyCutPolished: 0,
        ...details,
        archived: false,
        createdAt: new Date(),
      });
      importedLegacyIds.add(legacyId);
    }
  } catch (error) {
    // Bottle inventory remains usable if legacy Redis is unavailable.
    console.error("Failed to import legacy containers into bottle inventory:", error);
  }
}

/** Every active bottle is also a container; this is a detailed view of the same records. */
export async function getAllContainers(): Promise<Container[]> {
  await importLegacyContainers();
  const rows = await db.select().from(bottleInventory);
  return rows
    .filter((row) => !row.archived)
    .map(toContainer)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getContainer(id: string): Promise<Container | null> {
  await importLegacyContainers();
  const [row] = await db.select().from(bottleInventory).where(eq(bottleInventory.id, id)).limit(1);
  return row ? toContainer(row) : null;
}

/** Create a zero-count bottle or update the container details on an existing bottle. */
export async function upsertContainer(container: Container): Promise<void> {
  const [existing] = await db.select().from(bottleInventory).where(eq(bottleInventory.id, container.id)).limit(1);
  const details = {
    name: container.name.trim(),
    capacityWaterOz: Number(container.capacityWaterOz),
    containerShape: container.shape || "Bottle",
    containerCostPerUnitCents: Math.max(0, Math.round(Number(container.costPerUnit || 0) * 100)),
    containerSupplier: container.supplier || null,
    containerNotes: container.notes || null,
    archived: false,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(bottleInventory).set(details).where(eq(bottleInventory.id, container.id));
    return;
  }

  await db.insert(bottleInventory).values({
    id: container.id,
    ...details,
    qtyUncut: 0,
    qtyCutUnpolished: 0,
    qtyCutPolished: 0,
    createdAt: new Date(),
  });
}

/** Containers are shared bottle records, so removal is recoverable archival. */
export async function deleteContainer(id: string): Promise<void> {
  await db.update(bottleInventory).set({ archived: true, updatedAt: new Date() }).where(eq(bottleInventory.id, id));
}
