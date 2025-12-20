// lib/alcoholTypesStore.ts
import { kv } from "@vercel/kv";

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
  const ids = (await kv.smembers("alcohol-types:index")) as string[];
  if (ids.length === 0) {
    // Seed default data
    await seedDefaults();
    return [...SEED_DATA];
  }

  const promises = ids.map((id) => kv.get<AlcoholType>(`alcohol-type:${id}`));
  const results = await Promise.all(promises);
  return results.filter((t): t is AlcoholType => t !== null);
}

async function seedDefaults(): Promise<void> {
  for (const type of SEED_DATA) {
    await kv.set(`alcohol-type:${type.id}`, type);
    await kv.sadd("alcohol-types:index", type.id);
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
      existing.archived = false;
      await kv.set(`alcohol-type:${existing.id}`, existing);
    }
    return existing;
  }

  const created: AlcoholType = { id, name, sortOrder, archived: false };
  await kv.set(`alcohol-type:${id}`, created);
  await kv.sadd("alcohol-types:index", id);
  return created;
}

export async function setAlcoholTypeArchived(id: string, archived: boolean) {
  const found = await kv.get<AlcoholType>(`alcohol-type:${id}`);
  if (!found) return null;
  found.archived = !!archived;
  await kv.set(`alcohol-type:${id}`, found);
  return found;
}

export async function updateAlcoholType(
  id: string,
  patch: { name?: string; sortOrder?: number; archived?: boolean }
) {
  const found = await kv.get<AlcoholType>(`alcohol-type:${id}`);
  if (!found) return null;

  if (typeof patch.name !== "undefined") found.name = patch.name;
  if (typeof patch.sortOrder !== "undefined") found.sortOrder = patch.sortOrder;
  if (typeof patch.archived !== "undefined") found.archived = !!patch.archived;

  await kv.set(`alcohol-type:${id}`, found);
  return found;
}

export async function updateAlcoholTypesMany(
  updates: Array<{ id: string; name?: string; sortOrder?: number; archived?: boolean }>
) {
  const list = await readAll();
  const byId = new Map(list.map((t) => [t.id, t]));

  for (const u of updates) {
    const found = byId.get(u.id);
    if (!found) continue;

    let changed = false;
    if (typeof u.name !== "undefined" && u.name !== found.name) {
      found.name = u.name;
      changed = true;
    }
    if (typeof u.sortOrder !== "undefined" && u.sortOrder !== found.sortOrder) {
      found.sortOrder = u.sortOrder;
      changed = true;
    }
    if (typeof u.archived !== "undefined" && u.archived !== found.archived) {
      found.archived = !!u.archived;
      changed = true;
    }

    if (changed) {
      await kv.set(`alcohol-type:${u.id}`, found);
    }
  }

  return list;
}

export async function deleteAlcoholType(id: string): Promise<boolean> {
  const found = await kv.get<AlcoholType>(`alcohol-type:${id}`);
  if (!found) return false;

  await kv.del(`alcohol-type:${id}`);
  await kv.srem("alcohol-types:index", id);
  return true;
}