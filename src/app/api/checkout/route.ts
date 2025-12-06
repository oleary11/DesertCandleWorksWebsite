import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/userSession";
import { getUserById } from "@/lib/userStore";
import { getPromotionById } from "@/lib/promotionsStore";
import { validatePromotion } from "@/lib/promotionValidator";

export const runtime = "nodejs";

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;

// Extended line item to include variant metadata
type ExtendedLineItem = {
  price: string;
  quantity: number;
  metadata?: {
    productName?: string;
    productImage?: string;
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

    // Parse body for line items + optional pointsToRedeem + promotionId
    let promotionId: string | undefined;
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

    // Determine shipping options based on subtotal
    // Free shipping over $50, otherwise $7.99 standard or free local pickup
    const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] =
      subtotal >= 5000
        ? [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: 0, currency: "usd" },
                display_name: "Free Shipping",
                delivery_estimate: {
                  minimum: { unit: "business_day", value: 5 },
                  maximum: { unit: "business_day", value: 7 },
                },
              },
            },
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: 0, currency: "usd" },
                display_name: "Free Local Pickup (Scottsdale, AZ)",
              },
            },
          ]
        : [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: 799, currency: "usd" },
                display_name: "Standard Shipping",
                delivery_estimate: {
                  minimum: { unit: "business_day", value: 5 },
                  maximum: { unit: "business_day", value: 7 },
                },
              },
            },
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: 0, currency: "usd" },
                display_name: "Free Local Pickup (Scottsdale, AZ)",
              },
            },
          ];

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
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      billing_address_collection: "required", // Collect billing address (includes email)
      phone_number_collection: { enabled: true }, // Collect phone for shipping issues
      shipping_options: shippingOptions,
      metadata: sessionMetadata, // Pass product/variant info for webhook
      // Pre-fill email for logged-in users
      ...(userEmail && { customer_email: userEmail }),
      // automatic_tax: { enabled: true }, // Enable later once business address configured
    };

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