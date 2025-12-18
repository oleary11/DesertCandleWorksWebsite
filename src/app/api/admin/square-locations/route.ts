import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";

export const runtime = "nodejs";

/**
 * Get Square locations to find location ID
 * GET /api/admin/square-locations
 */
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Square not configured" }, { status: 500 });
  }

  try {
    const { SquareClient, SquareEnvironment } = await import("square");
    const client = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });

    const response = await client.locations.list();

    console.log("[Square Locations] Full response:", JSON.stringify(response, null, 2));

    const locations = response?.locations?.map((loc) => ({
      id: loc.id,
      name: loc.name,
      status: loc.status,
      type: loc.type,
      address: loc.address ? {
        addressLine1: loc.address.addressLine1,
        locality: loc.address.locality,
        administrativeDistrictLevel1: loc.address.administrativeDistrictLevel1,
        postalCode: loc.address.postalCode,
      } : null,
    })) || [];

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("[Square Locations] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch locations" },
      { status: 500 }
    );
  }
}
