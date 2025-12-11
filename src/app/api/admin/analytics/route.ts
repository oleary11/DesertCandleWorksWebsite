import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

// Helper function to check if an order is a manual sale
function isManualSale(orderId: string): boolean {
  return orderId.startsWith("MS") || orderId.toLowerCase().startsWith("manual");
}

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

    // Helper function to calculate Stripe fees
    // Stripe charges 2.9% + $0.30 per successful transaction
    function calculateStripeFee(amountCents: number): number {
      return Math.round(amountCents * 0.029) + 30; // 2.9% + 30 cents
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

      let compRevenue = 0;
      let compStripeFees = 0;

      for (const order of compOrders) {
        compRevenue += order.totalCents;
        if (!isManualSale(order.id)) {
          compStripeFees += calculateStripeFee(order.totalCents);
        }
      }

      const compNetRevenue = compRevenue - compStripeFees;
      const compOrderCount = compOrders.length;
      const compUnits = compOrders.reduce(
        (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      );

      comparisonData = {
        revenue: compRevenue,
        netRevenue: compNetRevenue,
        stripeFees: compStripeFees,
        orders: compOrderCount,
        units: compUnits,
        averageOrderValue: compOrderCount > 0 ? compRevenue / compOrderCount : 0,
      };
    }

    // Calculate overall metrics with Stripe fees, separating products, shipping, and tax
    let totalRevenue = 0;
    let totalProductRevenue = 0;
    let totalShippingRevenue = 0;
    let totalTaxCollected = 0;
    let totalStripeFees = 0;
    let stripeRevenue = 0; // Track revenue from Stripe orders only

    for (const order of completedOrders) {
      totalRevenue += order.totalCents;

      // Track product revenue separately from shipping
      const productRevenue = order.productSubtotalCents ?? order.totalCents;
      totalProductRevenue += productRevenue;

      // Track shipping revenue separately (handle old orders that don't have it stored)
      let shippingRevenue = order.shippingCents ?? 0;
      if (shippingRevenue === 0 && order.productSubtotalCents) {
        // For old orders, calculate shipping as: total - products - tax
        const taxAmount = order.taxCents ?? 0;
        shippingRevenue = order.totalCents - order.productSubtotalCents - taxAmount;
        // Ensure it's not negative
        if (shippingRevenue < 0) shippingRevenue = 0;
      }
      totalShippingRevenue += shippingRevenue;

      // Track tax collected
      const taxAmount = order.taxCents ?? 0;
      totalTaxCollected += taxAmount;

      // Only apply Stripe fees to Stripe orders (not manual sales)
      if (!isManualSale(order.id)) {
        totalStripeFees += calculateStripeFee(order.totalCents);
        stripeRevenue += order.totalCents;
      }
    }

    const netRevenue = totalRevenue - totalStripeFees;
    const totalOrders = completedOrders.length;
    const totalUnits = completedOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Build a map of product info
    const productMap = new Map(products.map((p) => [p.slug, p]));

    // Calculate sales by product, tracking Stripe fees, shipping, and tax per product
    const productSalesMap = new Map<
      string,
      {
        slug: string;
        name: string;
        units: number;
        revenue: number;
        stripeRevenue: number; // Track Stripe revenue separately
        stripeFees: number; // Per-product Stripe fees
        shippingCost: number; // Per-product shipping cost
        taxAmount: number; // Per-product tax collected
        alcoholType?: string;
      }
    >();

    for (const order of completedOrders) {
      const isStripeOrder = !isManualSale(order.id);
      const orderItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const orderStripeFee = isStripeOrder ? calculateStripeFee(order.totalCents) : 0;

      // Calculate shipping cost (handle old orders that don't have it stored)
      let orderShippingCost = order.shippingCents ?? 0;
      if (orderShippingCost === 0 && order.productSubtotalCents) {
        // For old orders, calculate shipping as: total - products - tax
        const taxAmount = order.taxCents ?? 0;
        orderShippingCost = order.totalCents - order.productSubtotalCents - taxAmount;
        // Ensure it's not negative
        if (orderShippingCost < 0) orderShippingCost = 0;
      }

      // Get tax amount for this order
      const orderTaxAmount = order.taxCents ?? 0;

      for (const item of order.items) {
        const existing = productSalesMap.get(item.productSlug);
        const product = productMap.get(item.productSlug);

        // Calculate this item's share of the order's Stripe fee, shipping, and tax
        // Divide by total items in the order (factoring in quantities)
        // Guard against division by zero
        const itemShare = orderItemCount > 0 ? item.quantity / orderItemCount : 0;
        const itemStripeFee = Math.round(orderStripeFee * itemShare);
        const itemShippingCost = Math.round(orderShippingCost * itemShare);
        const itemTaxAmount = Math.round(orderTaxAmount * itemShare);

        if (existing) {
          existing.units += item.quantity;
          existing.revenue += item.priceCents;
          existing.stripeFees += itemStripeFee;
          existing.shippingCost += itemShippingCost;
          existing.taxAmount += itemTaxAmount;
          if (isStripeOrder) {
            existing.stripeRevenue += item.priceCents;
          }
        } else {
          productSalesMap.set(item.productSlug, {
            slug: item.productSlug,
            name: item.productName,
            units: item.quantity,
            revenue: item.priceCents,
            stripeRevenue: isStripeOrder ? item.priceCents : 0,
            stripeFees: itemStripeFee || 0,
            shippingCost: itemShippingCost || 0,
            taxAmount: itemTaxAmount || 0,
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
      stripeFees: number;
      profit: number;
      marginPercent: number;
    }> = [];

    for (const productSale of productSales) {
      const product = productMap.get(productSale.slug);
      if (product?.materialCost && product.materialCost > 0) {
        // materialCost is in dollars, convert to cents
        const costPerUnitCents = Math.round(product.materialCost * 100);
        const totalCost = costPerUnitCents * productSale.units;

        // Calculate Stripe fees for this product's Stripe revenue only
        // Manual sales don't incur Stripe fees, so we only apply fees to stripeRevenue
        const stripeOrderRatio = stripeRevenue > 0 ? totalStripeFees / stripeRevenue : 0;
        const productStripeFees = Math.round(productSale.stripeRevenue * stripeOrderRatio);

        const profit = productSale.revenue - totalCost - productStripeFees;
        const marginPercent = productSale.revenue > 0 ? (profit / productSale.revenue) * 100 : 0;

        profitMargins.push({
          slug: productSale.slug,
          name: productSale.name,
          revenue: productSale.revenue,
          cost: totalCost,
          stripeFees: productStripeFees,
          profit,
          marginPercent,
        });
      }
    }

    // Sort by margin percent
    profitMargins.sort((a, b) => b.marginPercent - a.marginPercent);

    return NextResponse.json({
      totalRevenue,
      totalProductRevenue,
      totalShippingRevenue,
      totalTaxCollected,
      netRevenue,
      stripeFees: totalStripeFees,
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
