// API route to sync products to TikTok Shop
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getValidAccessToken, isTikTokShopConnected } from "@/lib/tiktokShop";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import type { Product } from "@/lib/products";

export async function POST(req: NextRequest) {
  // Verify admin is authenticated
  const authed = await isAdminAuthed(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if TikTok Shop is connected
    const connected = await isTikTokShopConnected();
    if (!connected) {
      return NextResponse.json(
        { error: "TikTok Shop not connected" },
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken();

    // Get all products
    const products = await listResolvedProducts();
    const visibleProducts = products.filter(p => p.visibleOnWebsite !== false);

    const results = {
      total: visibleProducts.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ slug: string; error: string }>,
    };

    // Sync each product to TikTok Shop
    for (const product of visibleProducts) {
      try {
        await syncProductToTikTokShop(product, accessToken);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          slug: product.slug,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`[TikTok Shop] Failed to sync product ${product.slug}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[TikTok Shop] Sync failed:", error);
    return NextResponse.json(
      {
        error: "Failed to sync products",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Get connection status
export async function GET(req: NextRequest) {
  const authed = await isAdminAuthed(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connected = await isTikTokShopConnected();
    return NextResponse.json({ connected });
  } catch (error) {
    console.error("[TikTok Shop] Status check failed:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

/**
 * Sync a single product to TikTok Shop
 */
async function syncProductToTikTokShop(product: Product, accessToken: string): Promise<void> {
  // TikTok Shop Products API endpoint
  const endpoint = "https://open.tiktokapis.com/product/create";

  // Transform our product data to TikTok Shop format
  const tiktokProduct = {
    title: product.name,
    description: product.description || product.seoDescription || "",
    category_id: "home_garden", // You may want to make this configurable
    brand_id: "", // Optional - set if you have a brand registered
    images: product.imageUrl ? [{ url: product.imageUrl }] : [],
    price: {
      currency: "USD",
      amount: product.price * 100, // TikTok Shop expects cents
    },
    inventory: {
      quantity: product.stock || 0,
    },
    product_id: product.sku, // Use SKU as external product ID
    is_cod_allowed: false,
    // Package dimensions (you may want to add these to your product schema)
    package_dimensions: {
      length: 5,
      width: 5,
      height: 8,
      unit: "INCH",
    },
    package_weight: {
      value: 1.5,
      unit: "POUND",
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(tiktokProduct),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`TikTok API error: ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  console.log(`[TikTok Shop] Product ${product.slug} synced successfully:`, result);
}
