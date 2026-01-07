export type WickType = {
  id: string;        // e.g., "standard" or "wood"
  name: string;      // e.g., "Standard Wick" or "Wood Wick"
};

export type ProductSize = {
  id: string;              // e.g., "8oz", "12oz"
  name: string;            // e.g., "8 oz", "12 oz"
  ozs: number;             // Size in ounces (for display/sorting)
  priceCents: number;      // Price for this size in cents
  stripePriceId?: string;  // Stripe price ID for this size
};

export type ProductVariant = {
  id: string;              // auto-generated: "8oz-standard-vanilla" or "standard-vanilla" (no size)
  size?: string;           // references ProductSize.id (optional)
  wickType: string;        // references WickType.id
  scent: string;           // references GlobalScent.id
  stock: number;           // Inventory for this variant
  sku: string;             // auto-generated: "DCW-0001-8OZ-STD-VAN"
  priceCents: number;      // Price in cents (from size or product base price)
  stripePriceId?: string;  // Stripe price ID (from size or product)
};

// New: Only stores wick types per product, scents are global
export type VariantConfig = {
  sizes?: ProductSize[];   // Optional: Multiple sizes with different prices
  wickTypes: WickType[];   // List of available wick types for THIS product
  // Scents are no longer stored here - they come from global scents
  // variantData stores: [sizeId-]wickTypeId-scentId -> {stock}
  variantData: Record<string, { stock: number }>;  // Stock data per variant ID
};

export type Product = {
  slug: string;
  name: string;
  price: number;            // Base price in dollars (for products without sizes)
  image?: string;           // Deprecated: Use images array instead (kept for backward compatibility)
  images?: string[];        // Multiple product images (primary image is first)
  sku: string;
  stripePriceId?: string;   // Base Stripe price ID (for products without sizes)
  squareCatalogId?: string; // Square Catalog Item ID for POS integration
  squareVariantMapping?: Record<string, string>; // Maps website variantId to Square variation ID
  seoDescription: string;
  bestSeller?: boolean;
  youngDumb?: boolean;      // Young & Dumb collection (fun, trendy bottles)
  stock: number;            // deprecated for variant products
  variantConfig?: VariantConfig;  // NEW: wick types + sizes + global scents → auto-generates variants
  alcoholType?: string;
  materialCost?: number;    // Cost to make the product (from calculator)
  visibleOnWebsite?: boolean;  // Controls shop page visibility (default: true)
  weight?: {                // Product weight for shipping (ShipStation)
    value: number;          // Weight value
    units: "ounces" | "pounds";  // Weight unit
  };
  dimensions?: {            // Package dimensions for shipping (ShipStation)
    length: number;         // Length in inches
    width: number;          // Width in inches
    height: number;         // Height in inches
    units: "inches";        // Dimension unit
  };
};

/**
 * Get the primary image for a product (first image in array or fallback to legacy image field)
 */
export function getPrimaryImage(product: Product): string | undefined {
  return product.images?.[0] ?? product.image;
}

/**
 * Get all images for a product (returns array, handles backward compatibility)
 */
export function getAllImages(product: Product): string[] {
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  if (product.image) {
    return [product.image];
  }
  return [];
}

/**
 * Generate all variant combinations from sizes + wick types + scents
 * NOTE: This now requires global scents to be passed in separately
 * @param product - The product with sizes, wick types, and variant data
 * @param globalScents - All scents available for this product (filtered by limited flag)
 */
export function generateVariants(product: Product, globalScents?: Array<{id: string, name: string}>): ProductVariant[] {
  if (!product.variantConfig) return [];
  if (!globalScents || globalScents.length === 0) return [];

  const { sizes, wickTypes, variantData } = product.variantConfig;
  const variants: ProductVariant[] = [];

  // Get base price and stripe price ID for products without sizes
  const basePriceCents = Math.round(product.price * 100);
  const baseStripePriceId = product.stripePriceId;

  // If sizes are configured, generate variants for each size
  if (sizes && sizes.length > 0) {
    for (const size of sizes) {
      for (const wick of wickTypes) {
        for (const scent of globalScents) {
          const variantId = `${size.id}-${wick.id}-${scent.id}`;
          const sizeCode = size.id.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const wickCode = wick.id === "wood" ? "WD" : wick.id.toUpperCase().substring(0, 3);
          const scentCode = scent.id.substring(0, 3).toUpperCase();

          const data = variantData[variantId] || { stock: 0 };

          variants.push({
            id: variantId,
            size: size.id,
            wickType: wick.id,
            scent: scent.id,
            stock: data.stock,
            sku: `${product.sku}-${sizeCode}-${wickCode}-${scentCode}`,
            priceCents: size.priceCents,
            stripePriceId: size.stripePriceId,
          });
        }
      }
    }
  } else {
    // No sizes - generate variants like before
    for (const wick of wickTypes) {
      for (const scent of globalScents) {
        const variantId = `${wick.id}-${scent.id}`;
        const wickCode = wick.id === "wood" ? "WD" : wick.id.toUpperCase().substring(0, 3);
        const scentCode = scent.id.substring(0, 3).toUpperCase();

        const data = variantData[variantId] || { stock: 0 };

        variants.push({
          id: variantId,
          wickType: wick.id,
          scent: scent.id,
          stock: data.stock,
          sku: `${product.sku}-${wickCode}-${scentCode}`,
          priceCents: basePriceCents,
          stripePriceId: baseStripePriceId,
        });
      }
    }
  }

  return variants;
}

export const products = [
  {
    slug: "titos-candle",
    name: "Titos Candle",
    price: 24.99,
    image: "/images/titos-min.png",
    sku: "DCW-0001",
    stripePriceId: "price_1SHV4MKrvd2Dq5RV3EdaRFpR",
    seoDescription: "Hand-poured candle in an upcycled Titos bottle.",
    bestSeller: true,
    stock: 0,
    alcoholType: "Vodka",        
  },
  {
    slug: "casamigos-candle",
    name: "Casamigos Candle",
    price: 24.99,
    image: "/images/casamigos-min.png",
    sku: "DCW-0002",
    stripePriceId: "price_1SHV3xKrvd2Dq5RVuVNYWqWO",
    seoDescription: "Hand-poured candle in an upcycled Casamigos bottle.",
    bestSeller: true,
    stock: 0,
    alcoholType: "Tequila",       
  },
  {
    slug: "stgermain-candle",
    name: "St. Germain Candle",
    price: 24.99,
    image: "/images/stgermain-min.png",
    sku: "DCW-0003",
    stripePriceId: "price_1SHsPCKrvd2Dq5RVSe3NDICE",
    seoDescription: "Hand-poured candle in an upcycled St. Germain bottle.",
    bestSeller: true,
    stock: 0,
    alcoholType: "Liqueur",     
  },
  {
    slug: "la-crema-candle",
    name: "La Crema Pinot Noir Candle",
    price: 19.99,
    image: "/images/lacrema-min.png",
    sku: "DCW-0004",
    stripePriceId: "price_1SHV5HKrvd2Dq5RVkxi7i16s",
    seoDescription: "Hand-poured candle in an upcycled Wine bottle.",
    stock: 0,
    alcoholType: "Wine",         
  },
  {
    slug: "new-amsterdam-gin-candle",
    name: "New Amsterdam Gin Candle",
    price: 24.99,
    image: "/images/newamsterdam-min.png",
    sku: "DCW-0005",
    stripePriceId: "price_1SHYksKrvd2Dq5RVDFHcOV5H",
    seoDescription: "Hand-poured candle in an upcycled New Amsterdam Gin bottle.",
    stock: 0,
    alcoholType: "Gin",             
  },
  {
    slug: "pink-whitney-candle",
    name: "Pink Whitney Candle",
    price: 24.99,
    image: "/images/pinkwhitney-min.png",
    sku: "DCW-0006",
    stripePriceId: "price_1SHYllKrvd2Dq5RVvtmFCBxD",
    seoDescription: "Hand-poured candle in an upcycled Pink Whitney bottle.",
    stock: 0,
    alcoholType: "Vodka",            
  },
  {
    slug: "ruffino-prosecco-candle",
    name: "Ruffino Prosecco Candle",
    price: 19.99,
    image: "/images/ruffino-min.png",
    sku: "DCW-0007",
    stripePriceId: "price_1SHYm2Krvd2Dq5RVc16I4NgK",
    seoDescription: "Hand-poured candle in an upcycled Ruffino Prosecco bottle.",
    stock: 0,
    alcoholType: "Wine",        
  },
  {
    slug: "santan-espresso-martini-candle",
    name: "Santan Espresso Martini Candle",
    price: 24.99,
    image: "/images/santanespresso-min.png",
    sku: "DCW-0008",
    stripePriceId: "price_1SHYmPKrvd2Dq5RVO8gzjTkL",
    seoDescription: "Hand-poured candle in an upcycled Santan Spirits Espresso Martini bottle.",
    stock: 0,
    alcoholType: "Liqueur",      
  },
  {
    slug: "bacardi-candle",
    name: "Bacardi Candle",
    price: 24.99,
    image: "/images/bacardi-min.png",
    sku: "DCW-0009",
    stripePriceId: "price_1SHYmeKrvd2Dq5RVDWj6eWDg",
    seoDescription: "Hand-poured candle in an upcycled Bacardi bottle.",
    stock: 0,
    alcoholType: "Rum",       
  },
  {
    slug: "mi-campo-tequila-candle",
    name: "Mi Campo Tequila Candle",
    price: 24.99,
    image: "/images/micampo-min.png",
    sku: "DCW-0010",
    stripePriceId: "price_1SHYmvKrvd2Dq5RVLCpSrDbj",
    seoDescription: "Hand-poured candle in an upcycled Mi Campo Tequila bottle.",
    stock: 0,
    alcoholType: "Tequila",    
  },
  {
    slug: "hendricks-gin-candle",
    name: "Hendrick's Gin Candle",
    price: 24.99,
    image: "/images/hendricks-min.png",
    sku: "DCW-0011",
    stripePriceId: "price_1SHYp2Krvd2Dq5RV2tqZN0d0",
    seoDescription: "Hand-poured candle in an upcycled Hendrick's Gin bottle.",
    stock: 0,
    alcoholType: "Gin",        
  },
  {
    slug: "grand-marnier-candle",
    name: "Grand Marnier Candle",
    price: 24.99,
    image: "/images/groundmarnier-min.png",
    sku: "DCW-0012",
    stripePriceId: "price_1SHYpMKrvd2Dq5RVgF9mIHev",
    seoDescription: "Hand-poured candle in an upcycled Grand Marnier bottle.",
    stock: 0,
    alcoholType: "Liqueur",     
  },
  {
    slug: "woodford-reserve-candle",
    name: "Woodford Reserve Candle",
    price: 29.99,
    image: "/images/woodford-min.png",
    sku: "DCW-0013",
    stripePriceId: "price_1SHYpXKrvd2Dq5RVh4qF83pQ",
    seoDescription: "Hand-poured candle in an upcycled Woodford Reserve bottle.",
    bestSeller: true,
    stock: 0,
    alcoholType: "Whiskey",       
  },
  {
    slug: "1800-tequila-candle",
    name: "1800 Tequila Candle",
    price: 24.99,
    image: "/images/1800-min.png",
    sku: "DCW-0014",
    stripePriceId: "price_1SHYpmKrvd2Dq5RVdRKMJMf2",
    seoDescription: "Hand-poured candle in an upcycled 1800 Tequila bottle.",
    stock: 0,
    alcoholType: "Tequila",         
  },
  {
    slug: "bulleit-bourbon-candle",
    name: "Bulleit Bourbon Candle",
    price: 24.99,
    image: "/images/bulleit-min.png",
    sku: "DCW-0015",
    stripePriceId: "price_1SHYpzKrvd2Dq5RVFMkda0YX",
    seoDescription: "Hand-poured candle in an upcycled Bulleit Bourbon bottle.",
    bestSeller: true,
    stock: 0,
    alcoholType: "Whiskey",         
  },
];
  
  export function getProduct(slug: string): Product | undefined {
    return products.find(p => p.slug === slug);
  }