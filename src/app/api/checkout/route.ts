import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/userSession";
import { getUserById } from "@/lib/userStore";
import { getPromotionById } from "@/lib/promotionsStore";
import { validatePromotion } from "@/lib/promotionValidator";
import { getPriceToProduct } from "@/lib/pricemap";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;

// Extended line item to include variant metadata
type ExtendedLineItem = {
  price: string;
  quantity: number;
  metadata?: {
    productName?: string;
    productImage?: string;
    size?: string;
    sizeName?: string;
    wickType?: string;
    scent?: string;
    variantId?: string;
  };
};

function isLineItemArray(v: unknown): v is ExtendedLineItem[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "price" in item &&
      "quantity" in item
  );
}

export async function POST(req: NextRequest) {
  // Rate limiting protection against checkout abuse
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rateLimitOk = await checkRateLimit(ip);

  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  // Use a stable, valid Stripe API version
  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });

  try {
    const ct = req.headers.get("content-type") || "";
    const accept = req.headers.get("accept") || "";
    let extendedLineItems: ExtendedLineItem[] = [];
    let pointsToRedeem: number | undefined;

    // Parse body for line items + optional pointsToRedeem + promotionId + shippingRateAmountCents + shippingAddress
    let promotionId: string | undefined;
    let shippingRateAmountCents: number | undefined;
    let shippingRateDescription: string | undefined;
    let isLocalPickup = false;
    let shippingAddress: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | undefined;

    if (ct.includes("application/json")) {
      const body: unknown = await req.json();
      if (body && typeof body === "object" && "lineItems" in body) {
        const raw = (body as { lineItems: unknown }).lineItems;
        if (isLineItemArray(raw)) {
          extendedLineItems = raw;
        }

        if (
          "pointsToRedeem" in body &&
          typeof (body as { pointsToRedeem: unknown }).pointsToRedeem ===
            "number"
        ) {
          pointsToRedeem = (body as { pointsToRedeem: number }).pointsToRedeem;
        }

        if (
          "promotionId" in body &&
          typeof (body as { promotionId: unknown }).promotionId === "string"
        ) {
          promotionId = (body as { promotionId: string }).promotionId;
        }

        if (
          "shippingRateAmountCents" in body &&
          typeof (body as { shippingRateAmountCents: unknown }).shippingRateAmountCents === "number"
        ) {
          shippingRateAmountCents = (body as { shippingRateAmountCents: number }).shippingRateAmountCents;
        }

        if (
          "shippingRateDescription" in body &&
          typeof (body as { shippingRateDescription: unknown }).shippingRateDescription === "string"
        ) {
          shippingRateDescription = (body as { shippingRateDescription: string }).shippingRateDescription;
        }

        if (
          "isLocalPickup" in body &&
          typeof (body as { isLocalPickup: unknown }).isLocalPickup === "boolean"
        ) {
          isLocalPickup = (body as { isLocalPickup: boolean }).isLocalPickup;
        }

        if (
          "shippingAddress" in body &&
          typeof (body as { shippingAddress: unknown }).shippingAddress === "object" &&
          (body as { shippingAddress: unknown }).shippingAddress !== null
        ) {
          const addr = (body as { shippingAddress: Record<string, unknown> }).shippingAddress;
          if (
            typeof addr.name === "string" &&
            typeof addr.line1 === "string" &&
            typeof addr.city === "string" &&
            typeof addr.state === "string" &&
            typeof addr.postalCode === "string" &&
            typeof addr.country === "string"
          ) {
            shippingAddress = {
              name: addr.name,
              line1: addr.line1,
              line2: typeof addr.line2 === "string" ? addr.line2 : undefined,
              city: addr.city,
              state: addr.state,
              postalCode: addr.postalCode,
              country: addr.country,
            };
          }
        }
      }
    } else {
      const form = await req.formData();
      const raw = form.get("lineItems");
      if (typeof raw === "string") {
        const parsed: unknown = JSON.parse(raw);
        if (isLineItemArray(parsed)) {
          extendedLineItems = parsed;
        }
      }
    }

    // SECURITY: Validate stock availability before creating Stripe session
    // This prevents race conditions and overselling
    const priceToProduct = await getPriceToProduct();
    const products = await listResolvedProducts();
    const productsBySlug = new Map(products.map(p => [p.slug, p]));

    for (const item of extendedLineItems) {
      const productInfo = priceToProduct.get(item.price);
      if (!productInfo) {
        return NextResponse.json(
          { error: "Invalid product in cart" },
          { status: 400 }
        );
      }

      const product = productsBySlug.get(productInfo.slug);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${productInfo.slug}` },
          { status: 404 }
        );
      }

      const requestedQty = item.quantity || 1;
      const variantId = item.metadata?.variantId;

      // Check variant stock if this is a variant product
      let availableStock: number;
      if (variantId && product.variantConfig) {
        const variantData = product.variantConfig.variantData[variantId];
        availableStock = variantData?.stock || 0;
      } else {
        availableStock = product.stock || 0;
      }

      if (availableStock < requestedQty) {
        return NextResponse.json(
          {
            error: `${product.name} is out of stock. Requested: ${requestedQty}, Available: ${availableStock}`,
          },
          { status: 409 }
        );
      }

      // SECURITY: Validate that the Stripe Price ID matches what we expect for this product
      // This prevents price manipulation attacks where clients submit arbitrary price IDs
      // Check both base product price and size-specific prices
      let validPriceId = false;

      // Check base product price ID
      if (product.stripePriceId && item.price === product.stripePriceId) {
        validPriceId = true;
      }

      // Check size-specific price IDs
      if (!validPriceId && product.variantConfig?.sizes) {
        for (const size of product.variantConfig.sizes) {
          if (size.stripePriceId && item.price === size.stripePriceId) {
            validPriceId = true;
            break;
          }
        }
      }

      if (!validPriceId) {
        console.error(`[Checkout Security] Price manipulation attempt detected: Got ${item.price} for product ${product.slug}, expected one of: base=${product.stripePriceId}, sizes=${product.variantConfig?.sizes?.map(s => s.stripePriceId).filter(Boolean).join(', ')}`);
        return NextResponse.json(
          {
            error: `Invalid price for ${product.name}. Please refresh and try again.`,
          },
          { status: 400 }
        );
      }
    }

    const origin =
      process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

    // Check if user is logged in (for email pre-fill and points)
    const userSession = await getUserSession();
    let userEmail: string | undefined;
    let discountAmountCents = 0;
    let userId: string | undefined;
    let promotionDiscountCents = 0;
    let appliedPromotionId: string | undefined;
    let stripePromotionCodeId: string | undefined;

    if (userSession) {
      const user = await getUserById(userSession.userId);
      if (user) {
        userEmail = user.email; // Pre-fill email in Stripe checkout
        userId = user.id;

        // Validate points redemption if provided
        if (pointsToRedeem && pointsToRedeem > 0) {
          if (user.points < pointsToRedeem) {
            return NextResponse.json(
              { error: "Insufficient points" },
              { status: 400 }
            );
          }

          // Calculate discount (1 point = 5 cents, or 100 points = $5)
          discountAmountCents = pointsToRedeem * 5;
        }
      }
    } else if (pointsToRedeem && pointsToRedeem > 0) {
      // Guest trying to redeem points - not allowed
      return NextResponse.json(
        { error: "Must be logged in to redeem points" },
        { status: 401 }
      );
    }

    // Fetch all price details from Stripe in parallel (needed to calculate order total)
    const priceIds = extendedLineItems.map((item) => item.price);
    const priceDetailsArray = await Promise.all(
      priceIds.map(async (priceId, index) => {
        try {
          return await stripe.prices.retrieve(priceId);
        } catch (error) {
          const productName =
            extendedLineItems[index].metadata?.productName ||
            "Unknown Product";
          console.error(
            `[Checkout] Failed to retrieve price ${priceId} for product "${productName}":`,
            error
          );
          throw new Error(
            `Invalid Stripe Price ID for "${productName}". Please update this product in the admin panel with a valid Stripe Price ID.`
          );
        }
      })
    );

    // Build session metadata to track what was purchased (for webhook)
    const sessionMetadata: Record<string, string> = {};
    if (pointsToRedeem && userId) {
      sessionMetadata.pointsRedeemed = pointsToRedeem.toString();
      sessionMetadata.userId = userId;
    }
    if (appliedPromotionId) {
      sessionMetadata.promotionId = appliedPromotionId;
    }

    // Build line items with custom names
    const lineItems: LineItem[] = [];

    for (let index = 0; index < extendedLineItems.length; index++) {
      const item = extendedLineItems[index];
      const priceDetails = priceDetailsArray[index];

      if (!priceDetails.unit_amount) {
        throw new Error(`Price ${item.price} has no unit_amount`);
      }

      // Store price ID, variant info, and product name in session metadata for webhook
      sessionMetadata[`item_${index}_price`] = item.price;
      if (item.metadata?.variantId) {
        sessionMetadata[`item_${index}_variant`] =
          item.metadata.variantId;
      }
      if (item.metadata?.sizeName) {
        sessionMetadata[`item_${index}_sizeName`] = item.metadata.sizeName;
      }

      // Build custom product name with variant details
      const productName = item.metadata?.productName || "Candle";
      sessionMetadata[`item_${index}_name`] = productName;
      let description = "";
      let imageUrl: string | undefined;

      // Convert relative image paths to absolute URLs (Stripe requires https://)
      if (item.metadata?.productImage) {
        const img = item.metadata.productImage;
        if (img.startsWith("http://") || img.startsWith("https://")) {
          imageUrl = img;
        } else if (img.startsWith("/")) {
          imageUrl = `${origin}${img}`;
        }
      }

      // Build visible description for checkout page
      if (item.metadata) {
        const variantParts: string[] = [];
        if (item.metadata.wickType)
          variantParts.push(item.metadata.wickType);
        if (item.metadata.scent) variantParts.push(item.metadata.scent);

        if (variantParts.length > 0) {
          description = variantParts.join(" • ");
        }
      }

      // Use price_data to show variant details on checkout page
      lineItems.push({
        price_data: {
          currency: priceDetails.currency,
          unit_amount: priceDetails.unit_amount,
          product_data: {
            name: productName,
            description: description || undefined,
            images: imageUrl ? [imageUrl] : undefined,
            metadata: {
              wickType: item.metadata?.wickType || "",
              scent: item.metadata?.scent || "",
              variantId: item.metadata?.variantId || "",
            },
          },
        },
        quantity: item.quantity,
      });
    }

    // Calculate subtotal for free shipping threshold
    const subtotal = lineItems.reduce((sum, item) => {
      const unitAmount = item.price_data?.unit_amount || 0;
      const quantity = item.quantity || 1;
      return sum + unitAmount * quantity;
    }, 0);

    // SECURITY: Store expected subtotal for verification in webhook
    // This prevents price manipulation if someone bypasses the checkout API
    sessionMetadata.expectedSubtotalCents = subtotal.toString();

    // Validate and apply promotion if provided
    if (promotionId) {
      const promotion = await getPromotionById(promotionId);

      if (!promotion) {
        return NextResponse.json(
          { error: "Invalid promotion" },
          { status: 400 }
        );
      }

      // Build cart items from line items for validation
      const cartItems = extendedLineItems.map((item, index) => {
        const priceDetails = priceDetailsArray[index];
        const productSlug = item.metadata?.variantId?.split("-")[0] || "unknown";

        return {
          productSlug,
          quantity: item.quantity,
          priceCents: priceDetails.unit_amount || 0,
        };
      });

      // Validate promotion
      const validation = await validatePromotion(promotionId, {
        userId,
        isGuest: !userId,
        cartItems,
        subtotalCents: subtotal,
      });

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Promotion is not valid" },
          { status: 400 }
        );
      }

      // Apply promotion discount
      promotionDiscountCents = validation.discountAmountCents || 0;
      appliedPromotionId = promotionId;
      stripePromotionCodeId = promotion.stripePromotionCodeId;
    }

    // SECURITY: Validate combined discounts don't exceed order total
    const totalDiscountCents = discountAmountCents + promotionDiscountCents;
    if (totalDiscountCents > subtotal) {
      // If promotion discount alone exceeds subtotal, it's invalid
      if (promotionDiscountCents >= subtotal) {
        return NextResponse.json(
          { error: "Promotion discount exceeds order total" },
          { status: 400 }
        );
      }

      // Cap points at remaining amount after promotion
      const maxPointsAllowed = Math.floor((subtotal - promotionDiscountCents) / 5);
      return NextResponse.json(
        {
          error: `After applying the promotion, you can redeem a maximum of ${maxPointsAllowed} points ($${(maxPointsAllowed * 5 / 100).toFixed(2)}) for this order.`
        },
        { status: 400 }
      );
    }

    // Build shipping options
    const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [];

    if (shippingAddress) {
      // SECURITY: Validate shipping address before fetching rates
      // This prevents shipping to invalid addresses and reduces fraud
      const { validateAddress, getShippingRates, getProductWeight } = await import("@/lib/shipstation");

      try {
        const validatedAddress = await validateAddress({
          name: shippingAddress.name,
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
        });

        console.log(`[Checkout] Address validated successfully`);

        // Use validated address for shipping rate calculation
        shippingAddress = {
          ...shippingAddress,
          line1: validatedAddress.street1,
          line2: validatedAddress.street2 || shippingAddress.line2,
          city: validatedAddress.city,
          state: validatedAddress.state,
          postalCode: validatedAddress.postalCode,
          country: validatedAddress.country,
        };
      } catch (validationError) {
        console.error(`[Checkout] Address validation failed:`, validationError);
        const errorMessage = validationError instanceof Error ? validationError.message : "Invalid shipping address";
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      // Calculate total weight
      let totalWeightOz = 0;
      for (const item of extendedLineItems) {
        const productInfo = priceToProduct.get(item.price);
        if (productInfo) {
          const product = productsBySlug.get(productInfo.slug);
          const quantity = item.quantity || 1;
          const sizeName = item.metadata?.sizeName;
          const weightPerItem = getProductWeight(product, sizeName);
          totalWeightOz += weightPerItem * quantity;
        }
      }

      // Get business postal code from environment
      const fromPostalCode = process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260";

      try {
        // Fetch shipping rates
        const rates = await getShippingRates(
          fromPostalCode,
          shippingAddress.postalCode,
          totalWeightOz,
          true, // residential
          shippingAddress.city,
          shippingAddress.state
        );

        // Add $2 for packing materials
        const PACKING_COST = 2.00;

        // Check if order qualifies for free shipping (over $100)
        const FREE_SHIPPING_THRESHOLD = 10000; // $100 in cents
        const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

        // Sort rates by cost to find cheapest
        const sortedRates = [...rates].sort((a, b) => a.shipmentCost - b.shipmentCost);

        // Deduplicate rates with same delivery time - keep only cheapest for each delivery time
        const ratesByDeliveryDays = new Map<number, typeof sortedRates[0]>();
        for (const rate of sortedRates) {
          const deliveryDays = rate.deliveryDays ?? 999; // Treat null as very slow
          const existing = ratesByDeliveryDays.get(deliveryDays);

          // If no rate for this delivery time, or this one is cheaper, use it
          if (!existing || rate.shipmentCost < existing.shipmentCost) {
            ratesByDeliveryDays.set(deliveryDays, rate);
          }
        }

        // Convert deduplicated rates to array and sort by price (cheapest first)
        // Stripe defaults to the first option, so we want cheapest first
        const deduplicatedRates = Array.from(ratesByDeliveryDays.values())
          .sort((a, b) => a.shipmentCost - b.shipmentCost);

        console.log(`[Checkout] Deduplicated ${rates.length} rates to ${deduplicatedRates.length} unique delivery times`);

        // Convert deduplicated rates to Stripe shipping options
        // First rate (cheapest) will be Stripe's default selection
        const overallCheapest = deduplicatedRates[0];
        for (const rate of deduplicatedRates) {
          const totalCost = rate.shipmentCost + PACKING_COST;
          const isCheapest = rate === overallCheapest;

          // Only make the cheapest option free if order qualifies
          const finalCost = qualifiesForFreeShipping && isCheapest ? 0 : totalCost;
          const displayName = qualifiesForFreeShipping && isCheapest
            ? `${rate.serviceName} (FREE)`
            : rate.serviceName;

          shippingOptions.push({
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: Math.round(finalCost * 100), currency: "usd" },
              display_name: displayName,
              delivery_estimate: rate.deliveryDays ? {
                minimum: { unit: "business_day", value: rate.deliveryDays },
                maximum: { unit: "business_day", value: rate.deliveryDays },
              } : undefined,
              metadata: {
                shipping_type: "carrier",
                carrier_code: rate.carrierCode,
                service_code: rate.serviceCode,
              },
            },
          });
        }

        // Always add local pickup as an option
        shippingOptions.push({
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            display_name: "Local Pickup (Scottsdale, AZ)",
            metadata: {
              shipping_type: "local_pickup",
            },
          },
        });

        // If no carrier rates available, that's okay - we still have local pickup
        if (shippingOptions.length === 1) {
          console.log("[Checkout] No carrier rates available, but offering local pickup");
        }
      } catch (error) {
        console.error("[Checkout] Failed to fetch shipping rates:", error);
        // Still offer local pickup even if carrier rates fail
        shippingOptions.push({
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            display_name: "Local Pickup (Scottsdale, AZ)",
            metadata: {
              shipping_type: "local_pickup",
            },
          },
        });
      }
    } else {
      // No shipping address provided
      return NextResponse.json(
        { error: "Please enter your shipping address" },
        { status: 400 }
      );
    }

    // Create discount coupon (Stripe only allows 1 discount per session)
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;

    // IMPORTANT: Stripe only allows ONE discount, so combine points + promotions into single coupon
    if (discountAmountCents > 0 && promotionDiscountCents > 0) {
      // Both points and promotion - combine into single coupon
      const totalDiscount = discountAmountCents + promotionDiscountCents;
      const promotion = appliedPromotionId ? await getPromotionById(appliedPromotionId) : null;

      const coupon = await stripe.coupons.create({
        amount_off: totalDiscount,
        currency: "usd",
        duration: "once",
        name: `${promotion?.name || "Promotion"} + Points (${pointsToRedeem})`,
      });

      discounts = [{ coupon: coupon.id }];
    } else if (discountAmountCents > 0) {
      // Only points redemption
      const coupon = await stripe.coupons.create({
        amount_off: discountAmountCents,
        currency: "usd",
        duration: "once",
        name: `Points Redemption (${pointsToRedeem} points)`,
      });

      discounts = [{ coupon: coupon.id }];
    } else if (promotionDiscountCents > 0) {
      // Only promotion discount
      const promotion = appliedPromotionId ? await getPromotionById(appliedPromotionId) : null;

      const coupon = await stripe.coupons.create({
        amount_off: promotionDiscountCents,
        currency: "usd",
        duration: "once",
        name: promotion?.name || "Promotion Discount",
      });

      discounts = [{ coupon: coupon.id }];
    }

    // Base params shared by both flows
    const baseParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/shop?status=success`,
      cancel_url: `${origin}/shop?status=cancelled`,
      billing_address_collection: "required", // Collect billing address (includes email)
      phone_number_collection: { enabled: true }, // Collect phone for shipping issues
      shipping_options: shippingOptions,
      metadata: sessionMetadata, // Pass product/variant info for webhook
      automatic_tax: { enabled: true }, // Stripe Tax enabled
    };

    // If shipping address provided, create a customer and lock the address
    // Otherwise, let Stripe collect it
    if (shippingAddress) {
      // Create a temporary customer with the shipping address locked
      const customer = await stripe.customers.create({
        name: shippingAddress.name,
        shipping: {
          name: shippingAddress.name,
          address: {
            line1: shippingAddress.line1,
            line2: shippingAddress.line2 || undefined,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.postalCode,
            country: shippingAddress.country,
          },
        },
        ...(userEmail && { email: userEmail }),
      });

      baseParams.customer = customer.id;

      // To show the shipping address on Stripe checkout, we need shipping_address_collection
      // but we can't make it editable since the customer already has the address locked
      // So we'll add it to the session metadata instead
      sessionMetadata.shipping_name = shippingAddress.name;
      sessionMetadata.shipping_line1 = shippingAddress.line1;
      if (shippingAddress.line2) sessionMetadata.shipping_line2 = shippingAddress.line2;
      sessionMetadata.shipping_city = shippingAddress.city;
      sessionMetadata.shipping_state = shippingAddress.state;
      sessionMetadata.shipping_zip = shippingAddress.postalCode;
      sessionMetadata.shipping_country = shippingAddress.country;
    } else {
      // No shipping address provided - let Stripe collect it
      baseParams.shipping_address_collection = { allowed_countries: ["US", "CA"] };
      // Pre-fill email for logged-in users (only when NOT using customer ID)
      if (userEmail) {
        baseParams.customer_email = userEmail;
      }
    }

    // ONLY send one of `discounts` or `allow_promotion_codes`
    let sessionParams: Stripe.Checkout.SessionCreateParams;
    if (discounts && discounts.length > 0) {
      // Using points: apply coupon, do NOT allow promotion codes
      sessionParams = {
        ...baseParams,
        discounts,
      };
    } else {
      // Not using points: allow promotion codes
      sessionParams = {
        ...baseParams,
        allow_promotion_codes: true,
      };
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    // Form posts: redirect; fetch calls: return JSON
    const isFormPost =
      !ct.includes("application/json") && !accept.includes("application/json");

    if (isFormPost) {
      return NextResponse.redirect(checkoutSession.url!, { status: 303 });
    }

    return NextResponse.json({ url: checkoutSession.url }, { status: 200 });
  } catch (e) {
    console.error("[Checkout] Error:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Checkout error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}