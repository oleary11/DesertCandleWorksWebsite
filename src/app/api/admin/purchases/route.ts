import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllPurchases, createPurchase, PurchaseItem } from "@/lib/purchasesStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const purchases = await getAllPurchases();
    return NextResponse.json(purchases);
  } catch (error) {
    console.error("[Purchases API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchases" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.vendorName || typeof body.vendorName !== "string") {
      return NextResponse.json(
        { error: "Vendor name is required" },
        { status: 400 }
      );
    }

    if (!body.purchaseDate || typeof body.purchaseDate !== "string") {
      return NextResponse.json(
        { error: "Purchase date is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.name || typeof item.name !== "string") {
        return NextResponse.json(
          { error: "Item name is required" },
          { status: 400 }
        );
      }

      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return NextResponse.json(
          { error: "Item quantity must be a positive number" },
          { status: 400 }
        );
      }

      if (typeof item.unitCostCents !== "number" || item.unitCostCents < 0) {
        return NextResponse.json(
          { error: "Item unit cost must be a non-negative number" },
          { status: 400 }
        );
      }

      if (!item.category || typeof item.category !== "string") {
        return NextResponse.json(
          { error: "Item category is required" },
          { status: 400 }
        );
      }
    }

    const shippingCents = body.shippingCents ?? 0;
    const taxCents = body.taxCents ?? 0;

    if (typeof shippingCents !== "number" || shippingCents < 0) {
      return NextResponse.json(
        { error: "Shipping cost must be a non-negative number" },
        { status: 400 }
      );
    }

    if (typeof taxCents !== "number" || taxCents < 0) {
      return NextResponse.json(
        { error: "Tax must be a non-negative number" },
        { status: 400 }
      );
    }

    const purchase = await createPurchase(
      body.vendorName.trim(),
      body.purchaseDate,
      body.items as PurchaseItem[],
      shippingCents,
      taxCents,
      body.receiptImageUrl,
      body.notes?.trim()
    );

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("[Purchases API] Error:", error);
    return NextResponse.json(
      { error: "Failed to create purchase" },
      { status: 500 }
    );
  }
}
