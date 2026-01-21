import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { orders, orderItems } from "@/lib/db/schema";
import { eq, and, gte, or, isNull } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * ShipStation Custom Store XML Endpoint
 *
 * This endpoint enables ShipStation's "Custom Store" integration, which unlocks:
 * - Automatic customer email notifications (shipped, out for delivery, delivered)
 * - Branded tracking page
 * - Real-time tracking updates without polling
 *
 * ShipStation calls this endpoint with two actions:
 * 1. action=export - Pull orders from our store (GET)
 * 2. action=shipnotify - Receive tracking info when labels are created (POST)
 *
 * Authentication: ShipStation uses Basic HTTP Auth with credentials you configure
 * in the Custom Store settings.
 */

/**
 * Verify Basic Auth credentials from ShipStation
 */
function verifyBasicAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  const expectedUsername = process.env.SHIPSTATION_CUSTOM_STORE_USERNAME;
  const expectedPassword = process.env.SHIPSTATION_CUSTOM_STORE_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    console.error("[ShipStation Custom Store] Credentials not configured");
    return false;
  }

  return username === expectedUsername && password === expectedPassword;
}

/**
 * Format a date for ShipStation XML (MM/DD/YYYY HH:mm)
 */
function formatShipStationDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build XML for a single order
 */
function buildOrderXml(order: {
  id: string;
  email: string;
  createdAt: Date;
  totalCents: number;
  shippingCents: number | null;
  taxCents: number | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  phone: string | null;
  shippingStatus: string | null;
  items: Array<{
    productName: string;
    productSlug: string;
    quantity: number;
    priceCents: number;
    sizeName: string | null;
    variantId: string | null;
  }>;
}): string {
  const items = order.items
    .map(
      (item) => `
      <Item>
        <SKU>${escapeXml(item.productSlug)}</SKU>
        <Name>${escapeXml(item.productName)}</Name>
        <Quantity>${item.quantity}</Quantity>
        <UnitPrice>${(item.priceCents / 100 / item.quantity).toFixed(2)}</UnitPrice>
      </Item>`
    )
    .join("");

  // ShipStation expects "awaiting_shipment" for orders ready to ship
  const orderStatus = order.shippingStatus === "shipped" ? "shipped" : "awaiting_shipment";

  return `
  <Order>
    <OrderID>${escapeXml(order.id)}</OrderID>
    <OrderNumber>${escapeXml(order.id)}</OrderNumber>
    <OrderDate>${formatShipStationDate(order.createdAt)}</OrderDate>
    <OrderStatus>${orderStatus}</OrderStatus>
    <LastModified>${formatShipStationDate(order.createdAt)}</LastModified>
    <ShippingMethod>Best Rate</ShippingMethod>
    <PaymentMethod>Credit Card</PaymentMethod>
    <OrderTotal>${(order.totalCents / 100).toFixed(2)}</OrderTotal>
    <TaxAmount>${((order.taxCents || 0) / 100).toFixed(2)}</TaxAmount>
    <ShippingAmount>${((order.shippingCents || 0) / 100).toFixed(2)}</ShippingAmount>
    <CustomerNotes></CustomerNotes>
    <InternalNotes></InternalNotes>
    <Gift>false</Gift>
    <GiftMessage></GiftMessage>
    <CustomField1></CustomField1>
    <CustomField2></CustomField2>
    <CustomField3></CustomField3>
    <Customer>
      <CustomerCode>${escapeXml(order.email)}</CustomerCode>
      <BillTo>
        <Name>${escapeXml(order.shippingName || "Customer")}</Name>
        <Company></Company>
        <Phone>${escapeXml(order.phone || "")}</Phone>
        <Email>${escapeXml(order.email)}</Email>
      </BillTo>
      <ShipTo>
        <Name>${escapeXml(order.shippingName || "Customer")}</Name>
        <Company></Company>
        <Address1>${escapeXml(order.shippingLine1 || "")}</Address1>
        <Address2>${escapeXml(order.shippingLine2 || "")}</Address2>
        <City>${escapeXml(order.shippingCity || "")}</City>
        <State>${escapeXml(order.shippingState || "")}</State>
        <PostalCode>${escapeXml(order.shippingPostalCode || "")}</PostalCode>
        <Country>${escapeXml(order.shippingCountry || "US")}</Country>
        <Phone>${escapeXml(order.phone || "")}</Phone>
      </ShipTo>
    </Customer>
    <Items>${items}
    </Items>
  </Order>`;
}

/**
 * GET handler - ShipStation pulls orders (action=export)
 */
export async function GET(req: NextRequest) {
  // Verify authentication
  if (!verifyBasicAuth(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action !== "export") {
    return new NextResponse("Invalid action", { status: 400 });
  }

  // Parse date range from ShipStation
  // ShipStation sends start_date and end_date in format: MM/DD/YYYY HH:mm
  const startDateParam = url.searchParams.get("start_date");
  const endDateParam = url.searchParams.get("end_date");
  const page = parseInt(url.searchParams.get("page") || "1");

  console.log(`[ShipStation Custom Store] Export request - start: ${startDateParam}, end: ${endDateParam}, page: ${page}`);

  // Parse dates (ShipStation format: MM/DD/YYYY HH:mm)
  let startDate: Date;
  if (startDateParam) {
    const [datePart, timePart] = startDateParam.split(" ");
    const [month, day, year] = datePart.split("/");
    const [hours, minutes] = (timePart || "00:00").split(":");
    startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  } else {
    // Default to 30 days ago
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  }

  try {
    // Fetch orders that are:
    // 1. Completed (paid)
    // 2. Not yet shipped OR recently shipped (ShipStation may re-fetch)
    // 3. Have a shipping address (not local pickup)
    // 4. Created within the date range
    const ordersResult = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "completed"),
          gte(orders.createdAt, startDate),
          // Must have shipping address (not local pickup)
          or(
            // Has shipping address
            and(
              orders.shippingLine1 !== null,
              orders.shippingCity !== null
            ),
            // Or explicitly not null check
            isNull(orders.shippingLine1) === false as unknown as ReturnType<typeof isNull>
          )
        )
      )
      .orderBy(orders.createdAt);

    // Filter to only orders with shipping addresses (SQL null checks can be tricky)
    const shippableOrders = ordersResult.filter(
      (o) => o.shippingLine1 && o.shippingCity && o.shippingPostalCode
    );

    console.log(`[ShipStation Custom Store] Found ${shippableOrders.length} shippable orders`);

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      shippableOrders.map(async (order) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        return {
          ...order,
          items,
        };
      })
    );

    // Build XML response
    const ordersXml = ordersWithItems.map(buildOrderXml).join("");

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Orders pages="${Math.ceil(ordersWithItems.length / 100)}">${ordersXml}
</Orders>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[ShipStation Custom Store] Error fetching orders:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * POST handler - ShipStation sends tracking info (action=shipnotify)
 */
export async function POST(req: NextRequest) {
  // Verify authentication
  if (!verifyBasicAuth(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action !== "shipnotify") {
    return new NextResponse("Invalid action", { status: 400 });
  }

  // ShipStation sends these as query params for shipnotify
  const orderNumber = url.searchParams.get("order_number");
  const carrier = url.searchParams.get("carrier");
  const service = url.searchParams.get("service");
  const trackingNumber = url.searchParams.get("tracking_number");

  console.log(`[ShipStation Custom Store] ShipNotify - Order: ${orderNumber}, Carrier: ${carrier}, Tracking: ${trackingNumber}`);

  if (!orderNumber || !trackingNumber) {
    return new NextResponse("Missing order_number or tracking_number", { status: 400 });
  }

  try {
    // Update order with tracking information
    const updateResult = await db
      .update(orders)
      .set({
        trackingNumber,
        carrierCode: carrier || undefined,
        serviceCode: service || undefined,
        shippingStatus: "shipped",
        shippedAt: new Date(),
      })
      .where(eq(orders.id, orderNumber))
      .returning({ id: orders.id });

    if (updateResult.length === 0) {
      console.warn(`[ShipStation Custom Store] Order ${orderNumber} not found`);
      // Still return 200 - ShipStation expects success
      return new NextResponse("OK", { status: 200 });
    }

    console.log(`[ShipStation Custom Store] Updated order ${orderNumber} with tracking ${trackingNumber}`);

    // Return success (ShipStation expects 2xx response)
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[ShipStation Custom Store] Error updating order:", error);
    // Still return 200 to prevent ShipStation from retrying endlessly
    return new NextResponse("OK", { status: 200 });
  }
}
