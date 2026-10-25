import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "./lib/db/client";
import { adminSessions } from "./lib/db/schema";
import { eq } from "drizzle-orm";

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

  // The session cookie is SameSite=Strict, so the browser leaves it off when an admin
  // page is opened from another site (e.g. the "Open in Admin Dashboard" link in Gmail).
  // Reload the same URL from our own page once; that request is same-site, so the
  // cookie comes along. Truly signed-out visitors land here again and go to login.
  if (
    !token &&
    req.method === "GET" &&
    !pathname.startsWith("/api/") &&
    req.headers.get("sec-fetch-site") === "cross-site" &&
    req.headers.get("sec-fetch-mode") === "navigate"
  ) {
    const target = JSON.stringify(pathname + (search || "")).replace(/</g, "\\u003c");
    return new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Opening…</title>` +
        `<script>location.replace(${target});</script></head><body></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
    );
  }

  // Redirect to login if not authenticated
  const loginUrl = new URL("/admin/login", req.url);
  const nextDest = pathname + (search || "");
  loginUrl.searchParams.set("next", nextDest);
  return NextResponse.redirect(loginUrl);
}