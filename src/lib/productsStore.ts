import { redis } from "./redis";
import { getProduct as getStaticProduct } from "@/lib/products"; // ← seed fallback

export type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  sku: string;
  stripePriceId?: string;
  seoDescription: string;
  bestSeller?: boolean;
  stock: number;
};

const key = (slug: string) => `product:${slug}`;
const INDEX_KEY = "products:index";

export async function listProducts(): Promise<Product[]> {
  const slugs = (await redis.smembers(INDEX_KEY)) as string[];
  if (!Array.isArray(slugs) || slugs.length === 0) return [];
  const keys = slugs.map((s: string) => key(s));
  const raw = (await redis.mget(...keys)) as Array<Product | null>;
  const items = raw.filter((p): p is Product => Boolean(p));
  return items.sort((a: Product, b: Product) => a.name.localeCompare(b.name));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const p = (await redis.get(key(slug))) as Product | null;
  return p ?? null;
}

export async function upsertProduct(p: Product): Promise<Product> {
  if (!p.slug) throw new Error("Missing slug");
  await redis.set(key(p.slug), p);
  await redis.sadd(INDEX_KEY, p.slug);
  return p;
}

export async function deleteProduct(slug: string): Promise<void> {
  await redis.del(key(slug));
  await redis.srem(INDEX_KEY, slug);
}

/** Ensure a live (Redis) record exists, seeding from static if needed */
async function ensureLive(slug: string): Promise<Product> {
  const live = await getProductBySlug(slug);
  if (live) return live;

  const s = getStaticProduct(slug);
  if (!s) throw new Error("Not found"); // truly unknown
  const seeded: Product = {
    ...s,
    stock: Math.max(0, Number(s.stock ?? 0)),
    price: Number(s.price),
    bestSeller:
      typeof (s as any).bestSeller === "string"
        ? /^(true|1|yes|on)$/i.test((s as any).bestSeller.trim())
        : Boolean(s.bestSeller),
  };
  await upsertProduct(seeded);
  return seeded;
}

export async function setStock(slug: string, value: number): Promise<number> {
  const p = await ensureLive(slug);              // ← seed if missing
  p.stock = Math.max(0, Math.floor(value));
  await upsertProduct(p);
  return p.stock;
}

export async function incrStock(slug: string, delta: number): Promise<number> {
  const p = await ensureLive(slug);              // ← seed if missing
  const next = (p.stock ?? 0) + Math.floor(delta);
  if (next < 0) throw new Error("Stock would go negative");
  p.stock = next;
  await upsertProduct(p);
  return p.stock;
}