import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get date range from query params
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const compareStartDate = searchParams.get("compareStartDate");
    const compareEndDate = searchParams.get("compareEndDate");

    // Fetch all orders and products
    const [orders, products] = await Promise.all([
      getAllOrders(),
      listResolvedProducts(),
    ]);

    // Filter to completed orders only
    let completedOrders = orders.filter((o) => o.status === "completed");

    console.log("[Analytics API] Total completed orders:", completedOrders.length);
    console.log("[Analytics API] Date filter:", { startDate, endDate });

    // Apply date range filter if provided
    if (startDate && endDate) {
      // Parse dates and set to start/end of day in UTC
      const start = new Date(startDate + "T00:00:00.000Z");
      const end = new Date(endDate + "T23:59:59.999Z");

      console.log("[Analytics API] Date range:", { start, end });

      const beforeFilter = completedOrders.length;
      completedOrders = completedOrders.filter((o) => {
        const orderDate = new Date(o.completedAt || o.createdAt);
        const included = orderDate >= start && orderDate <= end;
        if (!included) {
          console.log("[Analytics API] Excluding order:", {
            id: o.id,
            orderDate: orderDate.toISOString(),
            completedAt: o.completedAt,
            createdAt: o.createdAt,
          });
        }
        return included;
      });

      console.log("[Analytics API] Orders after filter:", completedOrders.length, "filtered out:", beforeFilter - completedOrders.length);
    }

    // Calculate comparison period data if requested
    let comparisonData = null;
    if (compareStartDate && compareEndDate) {
      const compStart = new Date(compareStartDate + "T00:00:00.000Z");
      const compEnd = new Date(compareEndDate + "T23:59:59.999Z");

      const compOrders = orders.filter((o) => {
        if (o.status !== "completed") return false;
        const orderDate = new Date(o.completedAt || o.createdAt);
        return orderDate >= compStart && orderDate <= compEnd;
      });

      const compRevenue = compOrders.reduce((sum, o) => sum + o.totalCents, 0);
      const compOrderCount = compOrders.length;
      const compUnits = compOrders.reduce(
        (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      );

      comparisonData = {
        revenue: compRevenue,
        orders: compOrderCount,
        units: compUnits,
        averageOrderValue: compOrderCount > 0 ? compRevenue / compOrderCount : 0,
      };
    }

    // Calculate overall metrics
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const totalOrders = completedOrders.length;
    const totalUnits = completedOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Build a map of product info
    const productMap = new Map(products.map((p) => [p.slug, p]));

    // Calculate sales by product
    const productSalesMap = new Map<
      string,
      { slug: string; name: string; units: number; revenue: number; alcoholType?: string }
    >();

    for (const order of completedOrders) {
      for (const item of order.items) {
        const existing = productSalesMap.get(item.productSlug);
        const product = productMap.get(item.productSlug);

        if (existing) {
          existing.units += item.quantity;
          existing.revenue += item.priceCents;
        } else {
          productSalesMap.set(item.productSlug, {
            slug: item.productSlug,
            name: item.productName,
            units: item.quantity,
            revenue: item.priceCents,
            alcoholType: product?.alcoholType,
          });
        }
      }
    }

    // Sort products by revenue
    const productSales = Array.from(productSalesMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    // Calculate sales by alcohol type
    const alcoholTypeSalesMap = new Map<
      string,
      { name: string; units: number; revenue: number }
    >();

    for (const product of productSales) {
      const alcoholType = product.alcoholType || "Other";
      const existing = alcoholTypeSalesMap.get(alcoholType);

      if (existing) {
        existing.units += product.units;
        existing.revenue += product.revenue;
      } else {
        alcoholTypeSalesMap.set(alcoholType, {
          name: alcoholType,
          units: product.units,
          revenue: product.revenue,
        });
      }
    }

    // Sort alcohol types by revenue
    const alcoholTypeSales = Array.from(alcoholTypeSalesMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    // Calculate profit margins (only for products with cost data)
    const profitMargins: Array<{
      slug: string;
      name: string;
      revenue: number;
      cost: number;
      profit: number;
      marginPercent: number;
    }> = [];

    for (const productSale of productSales) {
      const product = productMap.get(productSale.slug);
      if (product?.materialCost && product.materialCost > 0) {
        // materialCost is in dollars, convert to cents
        const costPerUnitCents = Math.round(product.materialCost * 100);
        const totalCost = costPerUnitCents * productSale.units;
        const profit = productSale.revenue - totalCost;
        const marginPercent = productSale.revenue > 0 ? (profit / productSale.revenue) * 100 : 0;

        profitMargins.push({
          slug: productSale.slug,
          name: productSale.name,
          revenue: productSale.revenue,
          cost: totalCost,
          profit,
          marginPercent,
        });
      }
    }

    // Sort by margin percent
    profitMargins.sort((a, b) => b.marginPercent - a.marginPercent);

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      totalUnits,
      averageOrderValue,
      productSales,
      alcoholTypeSales,
      profitMargins,
      dateRange: startDate && endDate ? { startDate, endDate } : null,
      comparison: comparisonData,
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to calculate analytics" },
      { status: 500 }
    );
  }
}
