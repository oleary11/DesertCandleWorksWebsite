import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

type RequestBody = {
  name: string;
  price: number; // Price in dollars
  description?: string;
  images?: string[]; // Array of image URLs
};

export async function POST(req: NextRequest) {
  try {
    // Middleware already checks admin auth
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });

    const body: RequestBody = await req.json();
    const { name, price, description, images } = body;

    // Validate required fields
    if (!name || price === undefined || price <= 0) {
      return NextResponse.json(
        { error: "Name and valid price are required" },
        { status: 400 }
      );
    }

    // Convert price to cents
    const priceInCents = Math.round(price * 100);

    console.log("[Create Stripe Product] Creating product:", { name, priceInCents, description });

    // Step 1: Create the product in Stripe
    const stripeProduct = await stripe.products.create({
      name,
      description: description || undefined,
      images: images && images.length > 0 ? images.slice(0, 8) : undefined, // Stripe allows max 8 images
      metadata: {
        source: "desert-candle-works",
        createdAt: new Date().toISOString(),
      },
    });

    console.log("[Create Stripe Product] Product created:", stripeProduct.id);

    // Step 2: Create a one-time price for this product
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: priceInCents,
      currency: "usd",
      metadata: {
        productName: name,
      },
    });

    console.log("[Create Stripe Product] Price created:", stripePrice.id);

    return NextResponse.json({
      success: true,
      productId: stripeProduct.id,
      priceId: stripePrice.id,
      price: priceInCents,
      message: "Stripe product and price created successfully",
    });
  } catch (error) {
    console.error("[Create Stripe Product] Error:", error);

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: "Stripe error",
          details: error.message,
          type: error.type,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create Stripe product",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
