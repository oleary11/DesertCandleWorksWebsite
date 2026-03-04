import { redis } from "@/lib/redis";
import DashboardClient, { type LayoutData } from "./DashboardClient";

const LAYOUT_KEY = "admin:dashboard:layout";

export default async function AdminHomePage() {
  let initialLayout: LayoutData | null = null;
  try {
    const saved = await redis.get(LAYOUT_KEY);
    if (
      saved &&
      typeof saved === "object" &&
      Array.isArray((saved as LayoutData).large) &&
      Array.isArray((saved as LayoutData).small)
    ) {
      initialLayout = saved as LayoutData;
    }
  } catch {
    // If Redis is unavailable, fall through to default layout
  }

  return <DashboardClient initialLayout={initialLayout} />;
}
