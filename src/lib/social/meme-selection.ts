import classics from "./meme-catalog.json";

export type MemeTemplate = { id: string; name: string; box_count: number };

/** Verified classics supplement the changing popular list; live metadata wins for duplicate IDs. */
export function mergeMemeTemplates(popular: MemeTemplate[]): MemeTemplate[] {
  const byId = new Map<string, MemeTemplate>();
  for (const t of [...classics, ...popular]) {
    if (t.id && Number.isInteger(t.box_count) && t.box_count >= 2 && t.box_count <= 8) byId.set(t.id, t);
  }
  return [...byId.values()];
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Avoid the last 40 formats. Reuse oldest formats only if there are too few fresh ones for this batch. */
export function selectMemeTemplates(templates: MemeTemplate[], recentIds: string[], needed = 1): MemeTemplate[] {
  const unique = [...new Map(templates.map(t => [t.id, t])).values()];
  const history = [...new Set(recentIds)].slice(0, 40);
  const recent = new Set(history);
  const fresh = shuffle(unique.filter(t => !recent.has(t.id)));
  if (fresh.length < needed) {
    for (const id of [...history].reverse()) {
      const template = unique.find(t => t.id === id);
      if (template) fresh.push(template);
      if (fresh.length >= needed) break;
    }
  }
  return fresh.slice(0, Math.max(60, needed));
}
