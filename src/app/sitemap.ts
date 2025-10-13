import { products } from "@/lib/products";
export default async function sitemap() {
  const base = "https://example.com"; // change after deploy
  const now = new Date().toISOString();
  const staticUrls = ["", "/shop", "/about", "/contact", "/policies"].map((p) => ({
    url: `${base}${p || "/"}`, lastModified: now,
  }));
  const productUrls = products.map((p) => ({
    url: `${base}/shop/${p.slug}`, lastModified: now,
  }));
  return [...staticUrls, ...productUrls];
}