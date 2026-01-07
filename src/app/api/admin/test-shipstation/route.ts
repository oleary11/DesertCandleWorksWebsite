import { NextRequest, NextResponse } from "next/server";
import { createShipStationOrder, type ShipStationOrder, getProductWeight } from "@/lib/shipstation";
import { listResolvedProducts } from "@/lib/resolvedProducts";

export const runtime = "nodejs";

/**
 * POST /api/admin/test-shipstation
 *
 * Creates a test order in ShipStation to verify API integration
 * This endpoint is admin-only and creates a realistic order with actual product data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.shippingAddress) {
      return NextResponse.json(
        { error: "Missing shippingAddress" },
        { status: 400 }
      );
    }

    const { shippingAddress, products, customerEmail, customerPhone, requestedShippingService, shippingAmount } = body;
    // Note: requestedShippingService is the customer's preferred shipping method
    // This will show in ShipStation as "Requested: [service name]"

    // Validate shipping address
    if (
      !shippingAddress.name ||
      !shippingAddress.line1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.postalCode
    ) {
      return NextResponse.json(
        { error: "Incomplete shipping address" },
        { status: 400 }
      );
    }

    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "Must include at least one product" },
        { status: 400 }
      );
    }

    // Get all products to validate SKUs and get weights
    const allProducts = await listResolvedProducts();
    const productsBySku = new Map(allProducts.map(p => [p.sku, p]));

    // Build ShipStation order items
    const orderItems = [];
    let totalAmount = 0;

    for (const item of products) {
      const product = productsBySku.get(item.sku);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.sku}` },
          { status: 404 }
        );
      }

      // Calculate weight for this item
      const weightPerItem = getProductWeight(product, item.sizeName);

      // For ShipStation, we need the candle weight (without packaging)
      // since ShipStation will add package weight separately
      const PACKAGING_WEIGHT_OZ = 16;
      const candleWeightOz = weightPerItem - PACKAGING_WEIGHT_OZ;

      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      const itemTotal = unitPrice * quantity;
      totalAmount += itemTotal;

      // Build item name with variant details for easy fulfillment
      let itemName = product.name;
      const variantDetails: string[] = [];
      if (item.sizeName) variantDetails.push(item.sizeName);
      if (item.wickType) variantDetails.push(item.wickType);
      if (item.scent) variantDetails.push(item.scent);

      if (variantDetails.length > 0) {
        itemName = `${product.name} (${variantDetails.join(' - ')})`;
      }

      orderItems.push({
        sku: product.sku,
        name: itemName,
        imageUrl: product.imageUrl,
        quantity: quantity,
        unitPrice: unitPrice,
        weight: {
          value: candleWeightOz,
          units: "ounces" as const,
        },
      });
    }

    // Get warehouse address from environment
    const warehouseAddress = {
      name: process.env.SHIPSTATION_FROM_NAME || "Desert Candle Works",
      company: "Desert Candle Works",
      street1: process.env.SHIPSTATION_FROM_ADDRESS || "123 Main St",
      city: process.env.SHIPSTATION_FROM_CITY || "Scottsdale",
      state: process.env.SHIPSTATION_FROM_STATE || "AZ",
      postalCode: process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260",
      country: "US",
      phone: process.env.SHIPSTATION_FROM_PHONE || "0000000000",
      residential: false,
    };

    // Build ShipStation order
    // Note: requestedShippingService tells ShipStation which service the customer selected
    // This will appear as "Requested: [service name]" in ShipStation
    const testOrder: ShipStationOrder = {
      orderNumber: `TEST-${Date.now()}`, // Unique test order number
      orderKey: `test-${Date.now()}`, // Unique order key
      orderDate: new Date().toISOString(),
      orderStatus: "awaiting_shipment",
      customerEmail: customerEmail || "test@example.com",
      billTo: warehouseAddress, // Use warehouse as billing address for test
      shipTo: {
        name: shippingAddress.name,
        company: shippingAddress.company || undefined,
        street1: shippingAddress.line1,
        street2: shippingAddress.line2 || undefined,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country || "US",
        phone: customerPhone || shippingAddress.phone || "0000000000",
        residential: true,
      },
      items: orderItems,
      amountPaid: totalAmount + (shippingAmount || 0),
      taxAmount: 0, // Set by Stripe in real orders
      shippingAmount: shippingAmount || 0,
      internalNotes: "⚠️ TEST ORDER - Created via admin panel for API testing",
      gift: false,
      requestedShippingService: requestedShippingService,
    };

    console.log(`[Admin] Creating test ShipStation order:`, JSON.stringify(testOrder, null, 2));

    // Create order in ShipStation
    const response = await createShipStationOrder(testOrder);

    console.log(`[Admin] Test order created successfully:`, response);

    return NextResponse.json({
      success: true,
      orderId: response.orderId,
      orderNumber: response.orderNumber,
      orderKey: response.orderKey,
      message: `Test order ${response.orderNumber} created successfully in ShipStation`,
    });
  } catch (error) {
    console.error("[Admin] ShipStation test error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create test order";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
