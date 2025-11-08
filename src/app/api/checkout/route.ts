import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

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
  return v.every(item =>
    typeof item === 'object' &&
    item !== null &&
    'price' in item &&
    'quantity' in item
  );
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Use a stable, valid Stripe API version
  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });

  try {
    const ct = req.headers.get("content-type") || "";
    const accept = req.headers.get("accept") || "";
    let extendedLineItems: ExtendedLineItem[] = [];

    if (ct.includes("application/json")) {
      const body: unknown = await req.json();
      if (body && typeof body === "object" && "lineItems" in body) {
        const raw = (body as { lineItems: unknown }).lineItems;
        if (isLineItemArray(raw)) extendedLineItems = raw;
      }
    } else {
      const form = await req.formData();
      const raw = form.get("lineItems");
      if (typeof raw === "string") {
        const parsed: unknown = JSON.parse(raw);
        if (isLineItemArray(parsed)) extendedLineItems = parsed;
      }
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

    // Fetch all price details from Stripe in parallel
    const priceIds = extendedLineItems.map(item => item.price);
    const priceDetailsArray = await Promise.all(
      priceIds.map(priceId => stripe.prices.retrieve(priceId))
    );

    // Build session metadata to track what was purchased (for webhook)
    const sessionMetadata: Record<string, string> = {};

    // Build line items with custom names
    const lineItems: LineItem[] = [];

    for (let index = 0; index < extendedLineItems.length; index++) {
      const item = extendedLineItems[index];
      const priceDetails = priceDetailsArray[index];

      if (!priceDetails.unit_amount) {
        throw new Error(`Price ${item.price} has no unit_amount`);
      }

      // Store price ID and variant info in session metadata for webhook
      sessionMetadata[`item_${index}_price`] = item.price;
      if (item.metadata?.variantId) {
        sessionMetadata[`item_${index}_variant`] = item.metadata.variantId;
      }

      // Build custom product name with variant details
      const productName = item.metadata?.productName || 'Candle';
      let description = '';
      let imageUrl: string | undefined;

      // Convert relative image paths to absolute URLs (Stripe requires https://)
      if (item.metadata?.productImage) {
        const img = item.metadata.productImage;
        if (img.startsWith('http://') || img.startsWith('https://')) {
          imageUrl = img;
        } else if (img.startsWith('/')) {
          // Relative path - make it absolute
          imageUrl = `${origin}${img}`;
        }
        // If invalid URL format, skip image
      }

      // Build visible description for checkout page
      if (item.metadata) {
        const variantParts: string[] = [];
        if (item.metadata.wickType) variantParts.push(item.metadata.wickType);
        if (item.metadata.scent) variantParts.push(item.metadata.scent);

        if (variantParts.length > 0) {
          description = variantParts.join(' • ');
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
              wickType: item.metadata?.wickType || '',
              scent: item.metadata?.scent || '',
              variantId: item.metadata?.variantId || '',
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
      return sum + (unitAmount * quantity);
    }, 0);

    // Determine shipping options based on subtotal
    // Free shipping over $50, otherwise $7.99 standard or free local pickup
    const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] =
      subtotal >= 5000 // $50 or more in cents
        ? [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 0, currency: 'usd' },
                display_name: 'Free Shipping',
                delivery_estimate: {
                  minimum: { unit: 'business_day', value: 5 },
                  maximum: { unit: 'business_day', value: 7 },
                },
              },
            },
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 0, currency: 'usd' },
                display_name: 'Free Local Pickup (Scottsdale, AZ)',
              },
            },
          ]
        : [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 799, currency: 'usd' },
                display_name: 'Standard Shipping',
                delivery_estimate: {
                  minimum: { unit: 'business_day', value: 5 },
                  maximum: { unit: 'business_day', value: 7 },
                },
              },
            },
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 0, currency: 'usd' },
                display_name: 'Free Local Pickup (Scottsdale, AZ)',
              },
            },
          ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/shop?status=success`,
      cancel_url: `${origin}/shop?status=cancelled`,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      billing_address_collection: "required", // Collect billing address (includes email)
      phone_number_collection: { enabled: true }, // Collect phone for shipping issues
      shipping_options: shippingOptions,
      allow_promotion_codes: true,
      metadata: sessionMetadata, // Pass product/variant info for webhook
      // Disable automatic tax for now - enable after setting business address in Stripe dashboard
      // automatic_tax: { enabled: true },
    });

    // Form posts: redirect; fetch calls: return JSON
    const isFormPost = !ct.includes("application/json") && !accept.includes("application/json");
    if (isFormPost) {
      return NextResponse.redirect(session.url!, { status: 303 });
    }
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Checkout error" }, { status: 500 });
  }
}