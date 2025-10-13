// app/admin/layout.tsx (or page.tsx)
import type { Metadata } from "next";
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: "Admin",
};
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}