import { products as staticProducts } from "@/lib/products";
import { listProducts, type Product } from "@/lib/productsStore";

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|1|yes|on)$/i.test(v.trim());
  if (typeof v === "number") return v === 1;
  return false;
}

/** Returns all products preferring live (Redis) and falling back to static */
export async function listResolvedProducts(): Promise<Product[]> {
  const live = await listProducts();
  const bySlug = new Map(live.map((p) => [p.slug, p]));

  for (const s of staticProducts) {
    if (!bySlug.has(s.slug)) {
      bySlug.set(s.slug, { ...s, stock: s.stock ?? 0 });
    }
  }

  const normalized = Array.from(bySlug.values()).map((p) => {
    return {
      ...p,
      bestSeller: coerceBool(p.bestSeller),
      stock: Math.max(0, Number(p.stock ?? 0)),
      price: Number(p.price),
    } as Product;
  });

  return normalized.sort((a, b) => a.name.localeCompare(b.name));
}