import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllPurchases, calculateItemAllocations } from "@/lib/purchasesStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const purchases = await getAllPurchases();

    // Calculate spending by category
    const spendingByCategory: Record<string, number> = {};
    const itemsByCategory: Record<string, number> = {};

    // Calculate spending by vendor
    const spendingByVendor: Record<string, number> = {};
    const purchasesByVendor: Record<string, number> = {};

    // Calculate spending over time (by month)
    const spendingByMonth: Record<string, number> = {};

    for (const purchase of purchases) {
      const allocations = calculateItemAllocations(
        purchase.items,
        purchase.shippingCents,
        purchase.taxCents
      );

      // Track vendor spending
      spendingByVendor[purchase.vendorName] = (spendingByVendor[purchase.vendorName] || 0) + purchase.totalCents;
      purchasesByVendor[purchase.vendorName] = (purchasesByVendor[purchase.vendorName] || 0) + 1;

      // Track spending by month
      const yearMonth = purchase.purchaseDate.substring(0, 7); // YYYY-MM
      spendingByMonth[yearMonth] = (spendingByMonth[yearMonth] || 0) + purchase.totalCents;

      // Track category spending (with fully loaded costs)
      for (const item of allocations) {
        const category = item.category || "other";
        spendingByCategory[category] = (spendingByCategory[category] || 0) + item.fullyLoadedCostCents;
        itemsByCategory[category] = (itemsByCategory[category] || 0) + item.quantity;
      }
    }

    // Sort and format data
    const categoryBreakdown = Object.entries(spendingByCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([category, totalCents]) => ({
        category,
        totalCents,
        itemCount: itemsByCategory[category] || 0,
      }));

    const vendorBreakdown = Object.entries(spendingByVendor)
      .sort(([, a], [, b]) => b - a)
      .map(([vendor, totalCents]) => ({
        vendor,
        totalCents,
        purchaseCount: purchasesByVendor[vendor] || 0,
      }));

    const monthlySpending = Object.entries(spendingByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, totalCents]) => ({
        month,
        totalCents,
      }));

    // Calculate totals
    const totalSpent = purchases.reduce((sum, p) => sum + p.totalCents, 0);
    const totalShipping = purchases.reduce((sum, p) => sum + p.shippingCents, 0);
    const totalTax = purchases.reduce((sum, p) => sum + p.taxCents, 0);
    const totalPurchases = purchases.length;

    return NextResponse.json({
      totalSpent,
      totalShipping,
      totalTax,
      totalPurchases,
      categoryBreakdown,
      vendorBreakdown,
      monthlySpending,
    });
  } catch (error) {
    console.error("[Purchase Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
