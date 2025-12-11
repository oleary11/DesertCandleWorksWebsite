import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getPurchaseById, updatePurchase, deletePurchase, PurchaseItem, Purchase } from "@/lib/purchasesStore";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const purchase = await getPurchaseById(params.id);

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error("[Purchase API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate items if provided
    if (body.items) {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          { error: "At least one item is required" },
          { status: 400 }
        );
      }

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
    }

    // Validate numeric fields if provided
    if (body.shippingCents !== undefined && (typeof body.shippingCents !== "number" || body.shippingCents < 0)) {
      return NextResponse.json(
        { error: "Shipping cost must be a non-negative number" },
        { status: 400 }
      );
    }

    if (body.taxCents !== undefined && (typeof body.taxCents !== "number" || body.taxCents < 0)) {
      return NextResponse.json(
        { error: "Tax must be a non-negative number" },
        { status: 400 }
      );
    }

    const updates: Partial<Omit<Purchase, "id" | "createdAt">> = {};
    if (body.vendorName) updates.vendorName = body.vendorName.trim();
    if (body.purchaseDate) updates.purchaseDate = body.purchaseDate;
    if (body.items) updates.items = body.items as PurchaseItem[];
    if (body.shippingCents !== undefined) updates.shippingCents = body.shippingCents;
    if (body.taxCents !== undefined) updates.taxCents = body.taxCents;
    if (body.receiptImageUrl !== undefined) updates.receiptImageUrl = body.receiptImageUrl;
    if (body.notes !== undefined) updates.notes = body.notes?.trim();

    const purchase = await updatePurchase(params.id, updates);

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error("[Purchase API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update purchase" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const success = await deletePurchase(params.id);

    if (!success) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Purchase API] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase" },
      { status: 500 }
    );
  }
}
