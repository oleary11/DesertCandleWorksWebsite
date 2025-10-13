import { redis } from "./redis";

// key helper
const stockKey = (slug: string) => `stock:${slug}`;

// Read stock; if missing, return null (so you can fall back to static seed)
export async function getLiveStock(slug: string): Promise<number | null> {
  const val = await redis.get<number>(stockKey(slug));
  return typeof val === "number" ? val : null;
}

// Set stock to an absolute value
export async function setStock(slug: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid stock");
  await redis.set(stockKey(slug), value);
  return value;
}

// Increment/decrement (e.g., +3 or -1)
export async function incrStock(slug: string, delta: number) {
  const newVal = await redis.incrby(stockKey(slug), delta);
  if (newVal < 0) {
    // prevent negative stock — revert
    await redis.incrby(stockKey(slug), -delta);
    throw new Error("Stock would go negative");
  }
  return newVal;
}