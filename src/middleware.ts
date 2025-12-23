import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "./lib/db/client";
import { adminSessions } from "./lib/db/schema";
import { eq, gt } from "drizzle-orm";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

const COOKIE_NAME = "admin_session";

export async function middleware(req: NextRequest) {
  const { pathname, search } = new URL(req.url);

  // Allow hitting these routes without authentication
  const publicPaths = [
    "/admin/login",
    "/api/admin/login",
    "/api/admin/logout",
    "/api/admin/users", // Allow unauthenticated first-time setup
  ];

  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Verify session token in Postgres (not just a simple cookie value)
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      // Check if session exists and hasn't expired
      const [session] = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.token, token))
        .limit(1);

      if (session && new Date(session.expiresAt) > new Date()) {
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