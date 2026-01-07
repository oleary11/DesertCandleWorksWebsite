import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders } from "@/lib/userStore";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { listRefunds } from "@/lib/refundStore";
import { getAllScents } from "@/lib/scents";

export const runtime = "nodejs";

// Helper function to check if an order is a manual sale
function isManualSale(orderId: string): boolean {
  return orderId.startsWith("MS") || orderId.toLowerCase().startsWith("manual");
}

type OrderItem = {
  productSlug: string;
  productName: string;
  quantity: number;
  priceCents: number;
  variantId?: string;
};

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  completedAt?: string;
  items: OrderItem[];
  productSubtotalCents?: number;
  shippingCents?: number;
  taxCents?: number;
};

type ResolvedProduct = {
  slug: string;
  alcoholType?: string;
  materialCost?: number; // dollars
};

type Refund = {
  orderId: string;
  amountCents: number;
  status: string;
};

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

    // Fetch all orders, products, and refunds
    const [ordersRaw, productsRaw, refundsRaw] = await Promise.all([
      getAllOrders(),
      listResolvedProducts(),
      listRefunds(),
    ]);

    const orders = ordersRaw as Order[];
    const products = productsRaw as ResolvedProduct[];
    const refunds = refundsRaw as Refund[];

    // Filter to completed orders only
    let completedOrders = orders.filter((o) => o.status === "completed");

    // Build refund map (orderId -> total refunded amount in cents)
    const refundMap = new Map<string, number>();
    const completedRefunds = refunds.filter((r) => r.status === "completed");
    for (const refund of completedRefunds) {
      const existing = refundMap.get(refund.orderId) ?? 0;
      refundMap.set(refund.orderId, existing + refund.amountCents);
    }

    // IMPORTANT: Exclude fully refunded orders from all analytics
    // An order is fully refunded if refundedAmount >= totalCents
    completedOrders = completedOrders.filter((o) => {
      const refundedAmount = refundMap.get(o.id) ?? 0;
      return refundedAmount < o.totalCents; // Keep only orders that aren't fully refunded
    });

    console.log("[Analytics API] Total completed orders:", completedOrders.length);
    console.log("[Analytics API] Total completed refunds:", completedRefunds.length);
    console.log("[Analytics API] Fully refunded orders excluded");
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

      console.log(
        "[Analytics API] Orders after filter:",
        completedOrders.length,
        "filtered out:",
        beforeFilter - completedOrders.length
      );
    }

    // Helper function to calculate Stripe fees
    // Stripe charges 2.9% + $0.30 per successful transaction
    function calculateStripeFee(amountCents: number): number {
      return Math.round(amountCents * 0.029) + 30; // 2.9% + 30 cents
    }

    // Calculate comparison period data if requested
    let comparisonData: {
      revenue: number;
      netRevenue: number;
      stripeFees: number;
      orders: number;
      units: number;
      averageOrderValue: number;
    } | null = null;

    if (compareStartDate && compareEndDate) {
      const compStart = new Date(compareStartDate + "T00:00:00.000Z");
      const compEnd = new Date(compareEndDate + "T23:59:59.999Z");

      const compOrders = orders.filter((o) => {
        if (o.status !== "completed") return false;
        const orderDate = new Date(o.completedAt || o.createdAt);

        // Exclude fully refunded orders from comparison period too
        const refundedAmount = refundMap.get(o.id) ?? 0;
        if (refundedAmount >= o.totalCents) return false;

        return orderDate >= compStart && orderDate <= compEnd;
      });

      let compRevenue = 0;
      let compStripeFees = 0;

      for (const order of compOrders) {
        const refundedAmount = refundMap.get(order.id) ?? 0;
        const netOrderRevenue = order.totalCents - refundedAmount;

        compRevenue += netOrderRevenue;
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
    let totalRefunded = 0; // Track total refunded amount

    for (const order of completedOrders) {
      const refundedAmount = refundMap.get(order.id) ?? 0;
      const netOrderRevenue = order.totalCents - refundedAmount;

      totalRevenue += netOrderRevenue;
      totalRefunded += refundedAmount;

      // Track product revenue separately from shipping
      const productRevenue = order.productSubtotalCents ?? order.totalCents;

      // Proportionally reduce product revenue by refund percentage
      const refundRatio = order.totalCents > 0 ? 1 - refundedAmount / order.totalCents : 1;
      totalProductRevenue += productRevenue * refundRatio;

      // Track shipping revenue separately (handle old orders that don't have it stored)
      let shippingRevenue = order.shippingCents ?? 0;
      if (shippingRevenue === 0 && order.productSubtotalCents != null) {
        // For old orders, calculate shipping as: total - products - tax
        const taxAmount = order.taxCents ?? 0;
        shippingRevenue = order.totalCents - order.productSubtotalCents - taxAmount;
        if (shippingRevenue < 0) shippingRevenue = 0;
      }
      totalShippingRevenue += shippingRevenue * refundRatio;

      // Track tax collected
      const taxAmount = order.taxCents ?? 0;
      totalTaxCollected += taxAmount * refundRatio;

      // Only apply Stripe fees to Stripe orders (not manual sales)
      // Note: Stripe fees are not refunded, so we still count them
      if (!isManualSale(order.id)) {
        totalStripeFees += calculateStripeFee(order.totalCents);
        stripeRevenue += netOrderRevenue;
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

    // Track products in orders that don't exist in current product database
    // These will still appear in Alcohol Type reports but not in Product Sales
    const missingProductSlugs = new Set<string>();

    for (const order of completedOrders) {
      const isStripeOrder = !isManualSale(order.id);
      const orderItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const orderStripeFee = isStripeOrder ? calculateStripeFee(order.totalCents) : 0;

      const refundedAmount = refundMap.get(order.id) ?? 0;
      const refundRatio = order.totalCents > 0 ? 1 - refundedAmount / order.totalCents : 1;

      // Calculate shipping cost (handle old orders that don't have it stored)
      let orderShippingCost = order.shippingCents ?? 0;
      if (orderShippingCost === 0 && order.productSubtotalCents != null) {
        const taxAmount = order.taxCents ?? 0;
        orderShippingCost = order.totalCents - order.productSubtotalCents - taxAmount;
        if (orderShippingCost < 0) orderShippingCost = 0;
      }

      const orderTaxAmount = order.taxCents ?? 0;

      for (const item of order.items) {
        const existing = productSalesMap.get(item.productSlug);
        const product = productMap.get(item.productSlug);

        // Track if product doesn't exist in current database
        if (!product) {
          missingProductSlugs.add(item.productSlug);
        }

        // Share of order costs based on quantity
        const itemShare = orderItemCount > 0 ? item.quantity / orderItemCount : 0;

        const itemStripeFee = Math.round(orderStripeFee * itemShare);
        const itemShippingCost = Math.round(orderShippingCost * itemShare * refundRatio);
        const itemTaxAmount = Math.round(orderTaxAmount * itemShare * refundRatio);

        const itemRevenue = Math.round(item.priceCents * refundRatio);

        if (existing) {
          existing.units += item.quantity;
          existing.revenue += itemRevenue;
          existing.stripeFees += itemStripeFee;
          existing.shippingCost += itemShippingCost;
          existing.taxAmount += itemTaxAmount;
          if (isStripeOrder) existing.stripeRevenue += itemRevenue;
        } else {
          productSalesMap.set(item.productSlug, {
            slug: item.productSlug,
            name: item.productName,
            units: item.quantity,
            revenue: itemRevenue,
            stripeRevenue: isStripeOrder ? itemRevenue : 0,
            stripeFees: itemStripeFee,
            shippingCost: itemShippingCost,
            taxAmount: itemTaxAmount,
            alcoholType: product?.alcoholType,
          });
        }
      }
    }

    const productSales = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Log warning if there are products in orders that don't exist in current database
    if (missingProductSlugs.size > 0) {
      console.warn(`[Analytics API] Warning: ${missingProductSlugs.size} product slug(s) in orders don't match current products:`, Array.from(missingProductSlugs));
      console.warn("[Analytics API] These products will appear with alcoholType='Other' in reports.");
      console.warn("[Analytics API] Consider updating order data or adding slug aliases to products.");
    }

    // Calculate sales by alcohol type
    const alcoholTypeSalesMap = new Map<string, { name: string; units: number; revenue: number }>();

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

    const alcoholTypeSales = Array.from(alcoholTypeSalesMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    // Variant parsing: "[sizeId-]wickTypeId-scentId"
    // Wick type IDs can contain hyphens (e.g., "standard-wick", "wood-wick")
    // Scent IDs are typically timestamps (e.g., "1765741870779")
    function parseVariantInfo(variantId?: string): { wick: string; scent: string } | null {
      if (!variantId) return null;

      // Known wick type patterns (with hyphens)
      const knownWickTypes = ['standard-wick', 'wood-wick', 'wood', 'standard'];

      // Try to match known wick types
      for (const wickType of knownWickTypes) {
        if (variantId.includes(wickType)) {
          // Extract scent ID after the wick type
          const wickIndex = variantId.indexOf(wickType);
          const afterWick = variantId.substring(wickIndex + wickType.length);

          // Remove leading hyphen if present
          const scentId = afterWick.startsWith('-') ? afterWick.substring(1) : afterWick;

          if (scentId) {
            return { wick: wickType, scent: scentId };
          }
        }
      }

      // Fallback: assume first part before first digit is wick type
      // This handles cases like "wood-1234" or "standard-1234"
      const match = variantId.match(/^([a-z-]+?)-?(\d+.*)$/);
      if (match) {
        return { wick: match[1], scent: match[2] };
      }

      return null;
    }

    // Load all scents to map IDs to names
    const allScents = await getAllScents();
    const scentIdToName = new Map<string, string>();
    for (const scent of allScents) {
      scentIdToName.set(scent.id, scent.name);
    }

    const scentSalesMap = new Map<string, { name: string; units: number; revenue: number }>();
    const wickTypeSalesMap = new Map<string, { name: string; units: number; revenue: number }>();

    for (const order of completedOrders) {
      const refundedAmount = refundMap.get(order.id) ?? 0;
      const refundRatio = order.totalCents > 0 ? 1 - refundedAmount / order.totalCents : 1;

      for (const item of order.items) {
        const variantInfo = parseVariantInfo(item.variantId);
        if (!variantInfo) continue;

        const itemRevenue = Math.round(item.priceCents * refundRatio);

        // Look up scent name from global scents, fallback to formatted ID
        const scentName = scentIdToName.get(variantInfo.scent) ||
          variantInfo.scent
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        // Group by scent NAME (not ID) so all variants of same scent are aggregated
        const existingScent = scentSalesMap.get(scentName);
        if (existingScent) {
          existingScent.units += item.quantity;
          existingScent.revenue += itemRevenue;
        } else {
          scentSalesMap.set(scentName, {
            name: scentName,
            units: item.quantity,
            revenue: itemRevenue,
          });
        }

        const wickName = variantInfo.wick === "wood" ? "Wood Wick" : "Standard Wick";
        const existingWick = wickTypeSalesMap.get(variantInfo.wick);
        if (existingWick) {
          existingWick.units += item.quantity;
          existingWick.revenue += itemRevenue;
        } else {
          wickTypeSalesMap.set(variantInfo.wick, {
            name: wickName,
            units: item.quantity,
            revenue: itemRevenue,
          });
        }
      }
    }

    const scentSales = Array.from(scentSalesMap.values()).sort((a, b) => b.revenue - a.revenue);
    const wickTypeSales = Array.from(wickTypeSalesMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    // Calculate revenue by payment source
    const paymentSourceSalesMap = new Map<string, { source: string; revenue: number; orders: number; units: number }>();

    for (const order of completedOrders) {
      const refundedAmount = refundMap.get(order.id) ?? 0;
      const netOrderRevenue = order.totalCents - refundedAmount;
      const orderUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

      let source = "Stripe"; // Default to Stripe for online orders

      // Detect Square orders (Square order IDs typically start with a specific pattern)
      if (order.id.startsWith("sq_") || order.id.match(/^[A-Z0-9]{22}$/)) {
        source = "Square";
      }
      // Detect manual sales
      else if (isManualSale(order.id)) {
        source = "Manual";
      }

      const existing = paymentSourceSalesMap.get(source);
      if (existing) {
        existing.revenue += netOrderRevenue;
        existing.orders += 1;
        existing.units += orderUnits;
      } else {
        paymentSourceSalesMap.set(source, {
          source,
          revenue: netOrderRevenue,
          orders: 1,
          units: orderUnits,
        });
      }
    }

    const paymentSourceSales = Array.from(paymentSourceSalesMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    // Profit margins (only for products with cost data)
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
        const costPerUnitCents = Math.round(product.materialCost * 100);
        const totalCost = costPerUnitCents * productSale.units;

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

    profitMargins.sort((a, b) => b.marginPercent - a.marginPercent);

    return NextResponse.json({
      totalRevenue,
      totalProductRevenue,
      totalShippingRevenue,
      totalTaxCollected,
      totalRefunded,
      netRevenue,
      stripeFees: totalStripeFees,
      totalOrders,
      totalUnits,
      averageOrderValue,
      productSales,
      alcoholTypeSales,
      scentSales,
      wickTypeSales,
      paymentSourceSales,
      profitMargins,
      dateRange: startDate && endDate ? { startDate, endDate } : null,
      comparison: comparisonData,
    });
  } catch (error: unknown) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json({ error: "Failed to calculate analytics" }, { status: 500 });
  }
}