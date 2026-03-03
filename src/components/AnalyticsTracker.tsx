"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function getOrCreateSessionId(): string {
  const KEY = "_dcw_sid";
  // Try localStorage first
  try {
    let sid = localStorage.getItem(KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    // localStorage blocked (Safari ITP, private browsing, strict settings)
    // Fall back to a session cookie so we still get tracking data
    try {
      const match = document.cookie.match(/(?:^|;\s*)_dcw_sid=([^;]+)/);
      if (match) return match[1];
      const sid = crypto.randomUUID();
      document.cookie = `${KEY}=${sid}; path=/; max-age=31536000; samesite=lax`;
      return sid;
    } catch {
      return "";
    }
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // Track page views on route change
  useEffect(() => {
    // Skip admin and API paths
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    // Avoid duplicate tracking on re-renders without navigation
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    const sessionId = getOrCreateSessionId();
    if (!sessionId) return;

    const referrer =
      typeof document !== "undefined" ? document.referrer : "";

    fetch("/api/t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        eventType: "page_view",
        path: pathname,
        referrer: referrer || undefined,
      }),
      keepalive: true,
    }).catch(() => {}); // Fire and forget — never let tracking break UX
  }, [pathname]);

  // Track time spent on each page (fires page_exit with durationSeconds)
  // Helps distinguish real users (seconds/minutes) from bots (< 1s)
  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    const sessionId = getOrCreateSessionId();
    if (!sessionId) return;

    const startTime = Date.now();
    const currentPath = pathname;
    let sent = false;

    function sendExit() {
      if (sent) return;
      sent = true;
      const duration = Math.round((Date.now() - startTime) / 1000);
      if (duration < 1) return; // sub-second exits are noise (bots, fast navigation)
      navigator.sendBeacon(
        "/api/t",
        new Blob(
          [JSON.stringify({ sessionId, eventType: "page_exit", path: currentPath, properties: { durationSeconds: duration } })],
          { type: "application/json" }
        )
      );
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendExit();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", sendExit);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", sendExit);
      sendExit(); // fires on SPA navigation (pathname change)
    };
  }, [pathname]);

  return null;
}

/**
 * Track a cart or checkout event from any client component.
 * Import and call this wherever cart/checkout actions occur.
 *
 * @example
 * trackEvent('cart_add', { productSlug: 'vanilla-oak', quantity: 1, priceCents: 2800 })
 * trackEvent('checkout_started')
 * trackEvent('checkout_completed')
 */
export function trackEvent(
  eventType: string,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;

  fetch("/api/t", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, eventType, properties }),
    keepalive: true,
  }).catch(() => {});
}
