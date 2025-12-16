import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { createOrder, completeOrder } from "@/lib/userStore";
import { incrStock, incrVariantStock } from "@/lib/productsStore";
import { logAdminAction } from "@/lib/adminLogs";
import crypto from "crypto";

export const runtime = "nodejs";

type ManualSaleItem = {
  productSlug: string;
  productName: string;
  quantity: number;
  priceCents: number;
  variantId?: string;
};

type ManualSaleRequest = {
  items: ManualSaleItem[];
  customerEmail?: string;
  paymentMethod: "cash" | "card" | "other";
  notes?: string;
  decrementStock?: boolean;
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as ManualSaleRequest;

    // Validate request
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      await logAdminAction({
        action: "manual-sale.create",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "missing_items" },
      });
      return NextResponse.json(
        { error: "Items array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!body.paymentMethod) {
      await logAdminAction({
        action: "manual-sale.create",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "missing_payment_method" },
      });
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.productSlug || !item.productName || !item.quantity || item.quantity < 1) {
        await logAdminAction({
          action: "manual-sale.create",
          adminEmail: "admin",
          ip,
          userAgent,
          success: false,
          details: { reason: "invalid_item", item },
        });
        return NextResponse.json(
          { error: "Each item must have productSlug, productName, and quantity >= 1" },
          { status: 400 }
        );
      }
      if (typeof item.priceCents !== "number" || item.priceCents < 0) {
        await logAdminAction({
          action: "manual-sale.create",
          adminEmail: "admin",
          ip,
          userAgent,
          success: false,
          details: { reason: "invalid_price", item },
        });
        return NextResponse.json(
          { error: "Each item must have a valid priceCents value" },
          { status: 400 }
        );
      }
    }

    // Generate a unique order ID for manual sales (uppercase alphanumeric)
    const randomBytes = crypto.randomBytes(16).toString("hex").toUpperCase();
    const orderId = `MS${randomBytes}`;

    // Calculate total
    const totalCents = body.items.reduce((sum, item) => sum + item.priceCents, 0);

    // Use provided email or default to admin/manual
    const customerEmail = body.customerEmail || "manual-sale@admin.local";

    // Process stock decrements (only if requested)
    if (body.decrementStock) {
      for (const item of body.items) {
        try {
          if (item.variantId) {
            // Decrement variant stock
            console.log(`[Manual Sale] Decrementing variant stock: ${item.productSlug} variant ${item.variantId} x${item.quantity}`);
            await incrVariantStock(item.productSlug, item.variantId, -item.quantity);
          } else {
            // Decrement base stock
            console.log(`[Manual Sale] Decrementing base stock: ${item.productSlug} x${item.quantity}`);
            await incrStock(item.productSlug, -item.quantity);
          }
        } catch (err) {
          console.error(`[Manual Sale] Stock decrement failed for ${item.productSlug} ${item.variantId ? `variant ${item.variantId}` : ''} x${item.quantity}`, err);
          return NextResponse.json(
            { error: `Failed to decrement stock for ${item.productName}: ${String(err)}` },
            { status: 400 }
          );
        }
      }
    } else {
      console.log(`[Manual Sale] Skipping stock decrement (custom order or made-to-order)`);
    }

    // Create order record
    const orderItems = body.items.map(item => ({
      productSlug: item.productSlug,
      productName: item.productName,
      quantity: item.quantity,
      priceCents: item.priceCents,
    }));

    // Create order (without userId for manual sales)
    await createOrder(
      customerEmail,
      orderId,
      totalCents,
      orderItems,
      undefined, // userId - no user for manual sales
      undefined, // productSubtotalCents
      undefined, // shippingCents
      undefined, // taxCents
      body.paymentMethod, // paymentMethod
      body.notes // notes
    );

    // Immediately complete the order
    await completeOrder(orderId);

    console.log(`[Manual Sale] Created and completed order ${orderId} - ${body.paymentMethod.toUpperCase()} - $${(totalCents / 100).toFixed(2)}`);
    if (body.notes) {
      console.log(`[Manual Sale] Notes: ${body.notes}`);
    }

    await logAdminAction({
      action: "manual-sale.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        orderId,
        totalCents,
        paymentMethod: body.paymentMethod,
        itemCount: body.items.length,
        items: body.items.map(i => ({
          productSlug: i.productSlug,
          productName: i.productName,
          quantity: i.quantity,
          priceCents: i.priceCents,
          variantId: i.variantId,
        })),
        decrementStock: body.decrementStock,
        notes: body.notes,
      },
    });

    return NextResponse.json({
      success: true,
      orderId,
      totalCents,
      message: `Manual sale recorded successfully via ${body.paymentMethod}`,
    });
  } catch (error) {
    console.error("[Manual Sale] Error:", error);
    await logAdminAction({
      action: "manual-sale.create",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to record manual sale", details: String(error) },
      { status: 500 }
    );
  }
}
