// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
    qualities: [75, 90],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "desertcandleworks.com" }], // non-www
        destination: "https://www.desertcandleworks.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;