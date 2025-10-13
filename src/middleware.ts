import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const { pathname, search } = new URL(req.url);

  // Allow hitting the login routes without a cookie
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/admin/login")) {
    return NextResponse.next();
  }

  // Check cookie set by the login API
  const ok = req.cookies.get("dcw_admin")?.value === "1";
  if (ok) return NextResponse.next();

  const loginUrl = new URL("/admin/login", req.url);
  // Preserve the "next" destination
  const nextDest = pathname + (search || "");
  loginUrl.searchParams.set("next", nextDest);
  return NextResponse.redirect(loginUrl);
}