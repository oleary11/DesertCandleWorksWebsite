/**
 * Square Product Mapping
 *
 * Maps Square catalog items to your website products.
 * This allows Square POS sales to automatically decrement the correct inventory.
 *
 * How to find Square Catalog IDs:
 * 1. Go to Square Dashboard: https://squareup.com/dashboard
 * 2. Go to Items > Items Library
 * 3. Click on an item to see its details
 * 4. The Catalog Object ID will be in the URL or item details
 *
 * Alternatively, use the Square API to list all catalog items:
 * curl https://connect.squareup.com/v2/catalog/list \
 *   -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
 */

export type SquareProductMapping = {
  slug: string; // Your website product slug
  name: string; // Product name (for reference)
  variantId?: string; // Optional variant ID if this maps to a specific variant
};

/**
 * Map Square Catalog Item IDs to website products
 *
 * Example:
 * "ABC123XYZ" -> { slug: "desert-sunset", name: "Desert Sunset" }
 * "DEF456UVW" -> { slug: "young-dumb", name: "Young Dumb", variantId: "wood-wick" }
 */
const SQUARE_TO_PRODUCT_MAP: Record<string, SquareProductMapping> = {
  // Add your mappings here when you set up Square
  // Example:
  // "SQUARE_CATALOG_ID_HERE": {
  //   slug: "desert-sunset",
  //   name: "Desert Sunset",
  // },
  // For variants:
  // "SQUARE_VARIANT_ID_HERE": {
  //   slug: "young-dumb",
  //   name: "Young Dumb (Wood Wick)",
  //   variantId: "wood-wick",
  // },
};

/**
 * Get the mapping of Square catalog IDs to products
 */
export async function getSquareProductMapping(): Promise<Map<string, SquareProductMapping>> {
  return new Map(Object.entries(SQUARE_TO_PRODUCT_MAP));
}

/**
 * Add or update a Square product mapping
 * (For future admin UI to manage mappings)
 */
export async function updateSquareMapping(
  catalogId: string,
  mapping: SquareProductMapping
): Promise<void> {
  // In the future, this could store mappings in Redis/KV
  // For now, mappings are hardcoded in this file
  SQUARE_TO_PRODUCT_MAP[catalogId] = mapping;
  console.log(`Updated Square mapping for ${catalogId}:`, mapping);
}

/**
 * Get all Square catalog items (for admin UI)
 * Requires Square API credentials
 */
export async function listSquareCatalogItems(): Promise<Array<{
  id: string;
  name: string;
  isMapped: boolean;
}>> {
  const { SquareClient, SquareEnvironment } = await import("square");
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN not configured");
  }

  const client = new SquareClient({
    token: accessToken,
    environment: process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });

  try {
    const items: any[] = [];
    let cursor: string | undefined;

    // Paginate through all catalog items
    do {
      const page = await client.catalog.list({ types: "ITEM", cursor });

      for await (const item of page) {
        items.push(item);
      }

      // Check if there are more pages
      cursor = undefined; // Page iteration handles pagination automatically
      break; // Exit after first page iteration (the for-await handles all pages)
    } while (cursor);

    return items.map((item: any) => ({
      id: item.id,
      name: item.itemData?.name || "Unknown Item",
      isMapped: !!SQUARE_TO_PRODUCT_MAP[item.id],
    }));
  } catch (error) {
    console.error("[Square] Failed to list catalog items:", error);
    throw error;
  }
}
