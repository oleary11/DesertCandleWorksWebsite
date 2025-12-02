import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getCalculatorSettings, updateCalculatorSettings, type CalculatorSettings } from "@/lib/calculatorSettings";

export const runtime = "nodejs";

// GET /api/admin/calculator-settings - Get calculator settings
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getCalculatorSettings();
  return NextResponse.json({ settings });
}

// POST /api/admin/calculator-settings - Update calculator settings
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const settings = body as CalculatorSettings;

    // Validate required fields
    if (settings.waxCostPerOz === undefined || settings.waterToWaxRatio === undefined || settings.defaultFragranceLoad === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: waxCostPerOz, waterToWaxRatio, defaultFragranceLoad" },
        { status: 400 }
      );
    }

    // Validate values are positive
    if (settings.waxCostPerOz < 0 || settings.waterToWaxRatio <= 0 || settings.defaultFragranceLoad < 0 || settings.defaultFragranceLoad > 1) {
      return NextResponse.json(
        { error: "Invalid values: costs must be non-negative, ratio must be positive, fragrance load must be 0-1" },
        { status: 400 }
      );
    }

    await updateCalculatorSettings(settings);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Failed to update calculator settings:", error);
    return NextResponse.json(
      { error: "Failed to update calculator settings" },
      { status: 500 }
    );
  }
}
