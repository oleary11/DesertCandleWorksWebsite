// Alcohol types management using Postgres
import { db } from "./db/client";
import { alcoholTypes } from "./db/schema";
import { eq } from "drizzle-orm";

export const ALCOHOL_TYPES_TAG = "alcohol-types";

export type AlcoholType = {
  id: string;
  name: string;
  sortOrder?: number;
  archived?: boolean;
};

const SEED_DATA: AlcoholType[] = [
  { id: "tequila", name: "Tequila", sortOrder: 10, archived: false },
  { id: "whiskey", name: "Whiskey", sortOrder: 20, archived: false },
  { id: "vodka", name: "Vodka", sortOrder: 30, archived: false },
  { id: "gin", name: "Gin", sortOrder: 40, archived: false },
  { id: "rum", name: "Rum", sortOrder: 50, archived: false },
  { id: "wine", name: "Wine", sortOrder: 60, archived: false },
  { id: "liqueur", name: "Liqueur", sortOrder: 70, archived: false },
  { id: "other", name: "Other", sortOrder: 9999, archived: false },
];

async function readAll(): Promise<AlcoholType[]> {
  const results = await db.select().from(alcoholTypes);

  if (results.length === 0) {
    await seedDefaults();
    return [...SEED_DATA];
  }

  return results.map((t) => ({
    id: t.id,
    name: t.name,
    sortOrder: t.sortOrder ?? undefined,
    archived: t.archived,
  }));
}

async function seedDefaults(): Promise<void> {
  for (const type of SEED_DATA) {
    await db.insert(alcoholTypes).values({
      id: type.id,
      name: type.name,
      sortOrder: type.sortOrder ?? 9999,
      archived: type.archived ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function getAlcoholTypes(): Promise<AlcoholType[]> {
  const list = await readAll();
  for (const t of list) if (typeof t.archived === "undefined") t.archived = false;
  return list.sort(
    (a, b) =>
      (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) ||
      a.name.localeCompare(b.name)
  );
}

export async function getActiveAlcoholTypes(): Promise<AlcoholType[]> {
  const all = await getAlcoholTypes();
  return all.filter((t) => !t.archived);
}

export async function addAlcoholType(name: string, sortOrder?: number): Promise<AlcoholType> {
  const list = await readAll();

  const id = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  const existing = list.find(
    (t) => t.id === id || t.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    if (existing.archived) {
      await db
        .update(alcoholTypes)
        .set({ archived: false, updatedAt: new Date() })
        .where(eq(alcoholTypes.id, existing.id));
      return { ...existing, archived: false };
    }
    return existing;
  }

  const created: AlcoholType = { id, name, sortOrder, archived: false };

  await db.insert(alcoholTypes).values({
    id: created.id,
    name: created.name,
    sortOrder: created.sortOrder ?? 9999,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return created;
}

export async function setAlcoholTypeArchived(id: string, archived: boolean): Promise<AlcoholType | null> {
  const [found] = await db
    .select()
    .from(alcoholTypes)
    .where(eq(alcoholTypes.id, id))
    .limit(1);

  if (!found) return null;

  await db
    .update(alcoholTypes)
    .set({ archived: !!archived, updatedAt: new Date() })
    .where(eq(alcoholTypes.id, id));

  return {
    id: found.id,
    name: found.name,
    sortOrder: found.sortOrder ?? undefined,
    archived: !!archived,
  };
}

export async function updateAlcoholType(
  id: string,
  patch: { name?: string; sortOrder?: number; archived?: boolean }
): Promise<AlcoholType | null> {
  const [found] = await db
    .select()
    .from(alcoholTypes)
    .where(eq(alcoholTypes.id, id))
    .limit(1);

  if (!found) return null;

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof patch.name !== "undefined") updateValues.name = patch.name;
  if (typeof patch.sortOrder !== "undefined") updateValues.sortOrder = patch.sortOrder;
  if (typeof patch.archived !== "undefined") updateValues.archived = !!patch.archived;

  await db
    .update(alcoholTypes)
    .set(updateValues)
    .where(eq(alcoholTypes.id, id));

  return {
    id: found.id,
    name: patch.name ?? found.name,
    sortOrder: patch.sortOrder ?? (found.sortOrder ?? undefined),
    archived: typeof patch.archived !== "undefined" ? !!patch.archived : found.archived,
  };
}

export async function updateAlcoholTypesMany(
  updates: Array<{ id: string; name?: string; sortOrder?: number; archived?: boolean }>
): Promise<AlcoholType[]> {
  const list = await readAll();
  const byId = new Map(list.map((t) => [t.id, t]));

  for (const u of updates) {
    const found = byId.get(u.id);
    if (!found) continue;

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    let changed = false;

    if (typeof u.name !== "undefined" && u.name !== found.name) {
      updateValues.name = u.name;
      found.name = u.name;
      changed = true;
    }
    if (typeof u.sortOrder !== "undefined" && u.sortOrder !== found.sortOrder) {
      updateValues.sortOrder = u.sortOrder;
      found.sortOrder = u.sortOrder;
      changed = true;
    }
    if (typeof u.archived !== "undefined" && u.archived !== found.archived) {
      updateValues.archived = !!u.archived;
      found.archived = !!u.archived;
      changed = true;
    }

    if (changed) {
      await db
        .update(alcoholTypes)
        .set(updateValues)
        .where(eq(alcoholTypes.id, u.id));
    }
  }

  return list;
}

export async function deleteAlcoholType(id: string): Promise<boolean> {
  const [found] = await db
    .select()
    .from(alcoholTypes)
    .where(eq(alcoholTypes.id, id))
    .limit(1);

  if (!found) return false;

  await db.delete(alcoholTypes).where(eq(alcoholTypes.id, id));
  return true;
}
