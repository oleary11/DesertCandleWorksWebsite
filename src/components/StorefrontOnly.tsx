"use client";

import { usePathname } from "next/navigation";

/** Renders its children everywhere except the admin area, which has its own chrome. */
export default function StorefrontOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
