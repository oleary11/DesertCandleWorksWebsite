// app/robots.ts
export default function robots() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}