import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redis } from "./lib/redis";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

const SESSIONS_PREFIX = "admin:session:";
const COOKIE_NAME = "admin_session";

export async function middleware(req: NextRequest) {
  const { pathname, search } = new URL(req.url);

  // Allow hitting the login routes without a cookie
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/admin/login") || pathname.startsWith("/api/admin/logout")) {
    return NextResponse.next();
  }

  // Verify session token in Redis (not just a simple cookie value)
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const sessionExists = await redis.get(SESSIONS_PREFIX + token);
      if (sessionExists) {
        return NextResponse.next();
      }
    } catch (err) {
      console.error("Session validation error:", err);
    }
  }

  // Redirect to login if not authenticated
  const loginUrl = new URL("/admin/login", req.url);
  const nextDest = pathname + (search || "");
  loginUrl.searchParams.set("next", nextDest);
  return NextResponse.redirect(loginUrl);
}