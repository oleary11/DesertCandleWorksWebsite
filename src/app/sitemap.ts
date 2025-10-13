import { listResolvedProducts } from "@/lib/resolvedProducts";

export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://example.com";
  const now = new Date().toISOString();

  const staticUrls = ["", "/shop", "/about", "/contact", "/policies"].map((p) => ({
    url: `${base}${p || "/"}`,
    lastModified: now,
  }));

  const products = await listResolvedProducts();
  const productUrls = products.map((p) => ({
    url: `${base}/shop/${p.slug}`,
    lastModified: now,
  }));

  return [...staticUrls, ...productUrls];
}