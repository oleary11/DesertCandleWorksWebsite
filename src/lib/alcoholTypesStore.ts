// lib/alcoholTypesStore.ts
import fs from "node:fs/promises";
import path from "node:path";

export const ALCOHOL_TYPES_TAG = "alcohol-types";

export type AlcoholType = {
  id: string;
  name: string;
  sortOrder?: number;
  archived?: boolean;
};

const DATA_PATH = path.join(process.cwd(), "data");
const FILE = path.join(DATA_PATH, "alcohol-types.json");

async function readAll(): Promise<AlcoholType[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf8");
  return JSON.parse(raw) as AlcoholType[];
}

async function writeAll(list: AlcoholType[]): Promise<void> {
  await fs.mkdir(DATA_PATH, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

async function ensureFile() {
  try {
    await fs.mkdir(DATA_PATH, { recursive: true });
    await fs.access(FILE);
  } catch {
    const seed: AlcoholType[] = [
      { id: "tequila", name: "Tequila", sortOrder: 10, archived: false },
      { id: "whiskey", name: "Whiskey", sortOrder: 20, archived: false },
      { id: "vodka", name: "Vodka", sortOrder: 30, archived: false },
      { id: "gin", name: "Gin", sortOrder: 40, archived: false },
      { id: "rum", name: "Rum", sortOrder: 50, archived: false },
      { id: "wine", name: "Wine", sortOrder: 60, archived: false },
      { id: "liqueur", name: "Liqueur", sortOrder: 70, archived: false },
      { id: "other", name: "Other", sortOrder: 9999, archived: false },
    ];
    await writeAll(seed);
  }
}

export async function getAlcoholTypes(): Promise<AlcoholType[]> {
  await ensureFile();
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
  await ensureFile();
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
    if (existing.archived) existing.archived = false;
    await writeAll(list);
    return existing;
  }

  const created: AlcoholType = { id, name, sortOrder, archived: false };
  list.push(created);
  await writeAll(list);
  return created;
}

export async function setAlcoholTypeArchived(id: string, archived: boolean) {
  await ensureFile();
  const list = await readAll();
  const found = list.find((t) => t.id === id);
  if (!found) return null;
  found.archived = !!archived;
  await writeAll(list);
  return found;
}

export async function updateAlcoholType(
  id: string,
  patch: { name?: string; sortOrder?: number; archived?: boolean }
) {
  await ensureFile();
  const list = await readAll();
  const found = list.find((t) => t.id === id);
  if (!found) return null;

  if (typeof patch.name !== "undefined") found.name = patch.name;
  if (typeof patch.sortOrder !== "undefined") found.sortOrder = patch.sortOrder;
  if (typeof patch.archived !== "undefined") found.archived = !!patch.archived;

  await writeAll(list);
  return found;
}

export async function updateAlcoholTypesMany(
  updates: Array<{ id: string; name?: string; sortOrder?: number; archived?: boolean }>
) {
  await ensureFile();
  const list = await readAll();
  const byId = new Map(list.map((t) => [t.id, t]));
  let changed = false;

  for (const u of updates) {
    const found = byId.get(u.id);
    if (!found) continue;
    if (typeof u.name !== "undefined" && u.name !== found.name) {
      found.name = u.name; changed = true;
    }
    if (typeof u.sortOrder !== "undefined" && u.sortOrder !== found.sortOrder) {
      found.sortOrder = u.sortOrder; changed = true;
    }
    if (typeof u.archived !== "undefined" && u.archived !== found.archived) {
      found.archived = !!u.archived; changed = true;
    }
  }

  if (changed) await writeAll(list);
  return list;
}

export async function deleteAlcoholType(id: string): Promise<boolean> {
  await ensureFile();
  const list = await readAll();
  const next = list.filter((t) => t.id !== id);
  const changed = next.length !== list.length;
  if (changed) await writeAll(next);
  return changed;
}