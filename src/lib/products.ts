export type WickType = {
  id: string;        // e.g., "standard" or "wood"
  name: string;      // e.g., "Standard Wick" or "Wood Wick"
};

export type ProductVariant = {
  id: string;              // auto-generated: "standard-vanilla"
  wickType: string;        // references WickType.id
  scent: string;           // references GlobalScent.id
  stock: number;           // Inventory for this variant
  sku: string;             // auto-generated: "DCW-0001-STD-VAN"
};

// New: Only stores wick types per product, scents are global
export type VariantConfig = {
  wickTypes: WickType[];   // List of available wick types for THIS product
  // Scents are no longer stored here - they come from global scents
  // variantData stores: wickTypeId-scentId -> {stock}
  variantData: Record<string, { stock: number }>;  // Stock data per variant ID
};

export type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  sku: string;
  stripePriceId?: string;   // Now used for ALL products (single price per product)
  seoDescription: string;
  bestSeller?: boolean;
  stock: number;            // deprecated for variant products
  variantConfig?: VariantConfig;  // NEW: wick types + global scents → auto-generates variants
};

/**
 * Generate all variant combinations from wick types + scents
 * NOTE: This now requires global scents to be passed in separately
 * @param product - The product with wick types
 * @param globalScents - All scents available for this product (filtered by experimental flag)
 */
export function generateVariants(product: Product, globalScents?: Array<{id: string, name: string}>): ProductVariant[] {
  if (!product.variantConfig) return [];
  if (!globalScents || globalScents.length === 0) return [];

  const { wickTypes, variantData } = product.variantConfig;
  const variants: ProductVariant[] = [];

  for (const wick of wickTypes) {
    for (const scent of globalScents) {
      const variantId = `${wick.id}-${scent.id}`;
      const wickCode = wick.id === "wood" ? "WD" : "STD";
      const scentCode = scent.id.substring(0, 3).toUpperCase();

      const data = variantData[variantId] || { stock: 0 };

      variants.push({
        id: variantId,
        wickType: wick.id,
        scent: scent.id,
        stock: data.stock,
        sku: `${product.sku}-${wickCode}-${scentCode}`,
      });
    }
  }

  return variants;
}

export const products = [
    {
        slug: "titos-candle",
        name: "Titos Candle",
        price: 24.99,
        image: "/images/titos.png",
        sku: "DCW-0001",
        stripePriceId: "price_1SHV4MKrvd2Dq5RV3EdaRFpR",
        seoDescription: "Hand-poured candle in an upcycled Titos bottle.",
        bestSeller: true,
        stock: 0
    },
    {
        slug: "casamigos-candle",
        name: "Casamigos Candle",
        price: 24.99,
        image: "/images/casamigos.png",
        sku: "DCW-0002",
        stripePriceId: "price_1SHV3xKrvd2Dq5RVuVNYWqWO",
        seoDescription: "Hand-poured candle in an upcycled Casamigos bottle.",
        bestSeller: true,
        stock: 0
    },
    {
        slug: "stgermain-candle",
        name: "St. Germain Candle",
        price: 24.99,
        image: "/images/stgermain.png",
        sku: "DCW-0003",
        stripePriceId: "price_1SHsPCKrvd2Dq5RVSe3NDICE",
        seoDescription: "Hand-poured candle in an upcycled St. Germain bottle.",
        bestSeller: true,
        stock: 0
    },
    {
        slug: "la-crema-candle",
        name: "La Crema Pinot Noir Candle",
        price: 19.99,
        image: "/images/lacrema.png",
        sku: "DCW-0004",
        stripePriceId: "price_1SHV5HKrvd2Dq5RVkxi7i16s",
        seoDescription: "Hand-poured candle in an upcycled Wine bottle.",
        stock: 0
      },
      {
        slug: "new-amsterdam-gin-candle",
        name: "New Amsterdam Gin Candle",
        price: 24.99,
        image: "/images/newamsterdam.png",
        sku: "DCW-0005",
        stripePriceId: "price_1SHYksKrvd2Dq5RVDFHcOV5H",
        seoDescription: "Hand-poured candle in an upcycled New Amsterdam Gin bottle.",
        stock: 0
      },
      {
        slug: "pink-whitney-candle",
        name: "Pink Whitney Candle",
        price: 24.99,
        image: "/images/pinkwhitney.png",
        sku: "DCW-0006",
        stripePriceId: "price_1SHYllKrvd2Dq5RVvtmFCBxD",
        seoDescription: "Hand-poured candle in an upcycled Pink Whitney bottle.",
        stock: 0
      },
      {
        slug: "ruffino-prosecco-candle",
        name: "Ruffino Prosecco Candle",
        price: 19.99,
        image: "/images/ruffino.png",
        sku: "DCW-0007",
        stripePriceId: "price_1SHYm2Krvd2Dq5RVc16I4NgK",
        seoDescription: "Hand-poured candle in an upcycled Ruffino Prosecco bottle.",
        stock: 0
      },
      {
        slug: "santan-espresso-martini-candle",
        name: "Santan Espresso Martini Candle",
        price: 24.99,
        image: "/images/santanespresso.png",
        sku: "DCW-0008",
        stripePriceId: "price_1SHYmPKrvd2Dq5RVO8gzjTkL",
        seoDescription: "Hand-poured candle in an upcycled Santan Spirits Espresso Martini bottle.",
        stock: 0
      },
      {
        slug: "bacardi-candle",
        name: "Bacardi Candle",
        price: 24.99,
        image: "/images/bacardi.png",
        sku: "DCW-0009",
        stripePriceId: "price_1SHYmeKrvd2Dq5RVDWj6eWDg",
        seoDescription: "Hand-poured candle in an upcycled Bacardi bottle.",
        stock: 0
      },
      {
        slug: "mi-campo-tequila-candle",
        name: "Mi Campo Tequila Candle",
        price: 24.99,
        image: "/images/micampo.png",
        sku: "DCW-0010",
        stripePriceId: "price_1SHYmvKrvd2Dq5RVLCpSrDbj",
        seoDescription: "Hand-poured candle in an upcycled Mi Campo Tequila bottle.",
        stock: 0
      },
      {
        slug: "hendricks-gin-candle",
        name: "Hendrick's Gin Candle",
        price: 24.99,
        image: "/images/hendricks.png",
        sku: "DCW-0011",
        stripePriceId: "price_1SHYp2Krvd2Dq5RV2tqZN0d0",
        seoDescription: "Hand-poured candle in an upcycled Hendrick's Gin bottle.",
        stock: 0
      },
      {
        slug: "grand-marnier-candle",
        name: "Grand Marnier Candle",
        price: 24.99,
        image: "/images/groundmarnier.png",
        sku: "DCW-0012",
        stripePriceId: "price_1SHYpMKrvd2Dq5RVgF9mIHev",
        seoDescription: "Hand-poured candle in an upcycled Grand Marnier bottle.",
        stock: 0
      },
      {
        slug: "woodford-reserve-candle",
        name: "Woodford Reserve Candle",
        price: 29.99,
        image: "/images/woodford.png",
        sku: "DCW-0013",
        stripePriceId: "price_1SHYpXKrvd2Dq5RVh4qF83pQ",
        seoDescription: "Hand-poured candle in an upcycled Woodford Reserve bottle.",
        bestSeller: true,
        stock: 0
      },
      {
        slug: "1800-tequila-candle",
        name: "1800 Tequila Candle",
        price: 24.99,
        image: "/images/1800.png",
        sku: "DCW-0014",
        stripePriceId: "price_1SHYpmKrvd2Dq5RVdRKMJMf2",
        seoDescription: "Hand-poured candle in an upcycled 1800 Tequila bottle.",
        stock: 0
      },
      {
        slug: "bulleit-bourbon-candle",
        name: "Bulleit Bourbon Candle",
        price: 24.99,
        image: "/images/bulleit.png",
        sku: "DCW-0015",
        stripePriceId: "price_1SHYpzKrvd2Dq5RVFMkda0YX",
        seoDescription: "Hand-poured candle in an upcycled Bulleit Bourbon bottle.",
        bestSeller: true,
        stock: 0
      },
  ];
  
  export function getProduct(slug: string): Product | undefined {
    return products.find(p => p.slug === slug);
  }