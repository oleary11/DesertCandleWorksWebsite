import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

export async function GET() {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all orders and products
    const [orders, products] = await Promise.all([
      getAllOrders(),
      listResolvedProducts(),
    ]);

    // Filter to completed orders only
    const completedOrders = orders.filter((o) => o.status === "completed");

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
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to calculate analytics" },
      { status: 500 }
    );
  }
}
