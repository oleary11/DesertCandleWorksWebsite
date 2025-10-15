"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function EntranceCheck() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip if we're already on the entrance page or admin pages
    if (pathname === "/entrance" || pathname?.startsWith("/admin")) {
      return;
    }

    // Check if this is the user's first visit
    const hasVisited = localStorage.getItem("dcw_has_visited");

    if (hasVisited !== "true" && pathname === "/") {
      router.push("/entrance");
    }
  }, [pathname, router]);

  return null;
}
