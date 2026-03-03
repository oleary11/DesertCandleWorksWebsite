import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Public diagnostic endpoint — returns the visitor's own IP and what Vercel
// resolves it to (country/region/city). Safe to share with anyone since it only
// reflects their own connection info, same as whatismyip.com.
// Use: share yourdomain.com/api/admin/debug-geo with someone and ask them to open it.
// If region shows the wrong state, it's an ISP/IP-registration issue we can't fix.
export async function GET(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  const country = req.headers.get("x-vercel-ip-country");
  const region = req.headers.get("x-vercel-ip-country-region");
  const cityRaw = req.headers.get("x-vercel-ip-city");
  const city = cityRaw ? decodeURIComponent(cityRaw) : null;

  return NextResponse.json({
    yourIp: ip,
    detectedLocation: {
      country,
      state: region,
      city,
    },
    note: "This is how your traffic appears in analytics. If the state or city is wrong, your ISP's IP block is registered to a different location — this is an ISP issue outside our control.",
  });
}
