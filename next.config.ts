// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Exclude sharp from bundling for better compatibility with Vercel/serverless
  serverExternalPackages: ["sharp"],

  eslint: {
    ignoreDuringBuilds: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
    qualities: [75, 90],
  },

  async redirects() {
    // ✅ In dev, don't do host-based canonical redirects.
    // In prod (Vercel), keep your non-www -> www redirect.
    if (!isProd) return [];

    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "desertcandleworks.com" }], // non-www
        destination: "https://www.desertcandleworks.com/:path*",
        permanent: true,
        // Exclude webhook endpoints from redirect
        missing: [
          { type: "header", key: "x-square-hmacsha256-signature" }, // Square webhooks
        ],
      },
    ];
  },

  async headers() {
    // Build CSP with a dev/prod difference:
    // - In dev: DO NOT include upgrade-insecure-requests (breaks http LAN dev)
    // - In prod: include it (good security)
    const cspParts = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://m.stripe.network https://api.buttondown.email",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    if (isProd) {
      cspParts.push("upgrade-insecure-requests");
    }

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspParts.join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;