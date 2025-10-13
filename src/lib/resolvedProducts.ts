import { products as staticProducts } from "@/lib/products";
import { listProducts, type Product } from "@/lib/productsStore";

export async function listResolvedProducts(): Promise<Product[]> {
  const live = await listProducts();
  const bySlug = new Map(live.map((p) => [p.slug, p]));

  for (const s of staticProducts) {
    if (!bySlug.has(s.slug)) {
      bySlug.set(s.slug, { ...s, stock: s.stock ?? 0 });
    }
  }

  const normalized = Array.from(bySlug.values()).map((p) => {
    const raw = (p as any).bestSeller;

    const bestSeller =
      typeof raw === "boolean"
        ? raw
        : typeof raw === "string"
        ? /^(true|1|yes|on)$/i.test(raw.trim())
        : typeof raw === "number"
        ? raw === 1
        : false;

    return {
      ...p,
      bestSeller,
      stock: Math.max(0, Number(p.stock ?? 0)),
      price: Number(p.price),
    } as Product;
  });

  return normalized.sort((a, b) => a.name.localeCompare(b.name));
}