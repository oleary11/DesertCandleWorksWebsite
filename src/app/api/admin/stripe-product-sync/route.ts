import { NextRequest, NextResponse } from "next/server";
import { listProducts, getProductBySlug } from "@/lib/productsStore";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});

type ProductSyncStatus = {
  slug: string;
  name: string;
  stripePriceId: string | null;
  hasImage: boolean;
  imageUrl: string | null;
  needsSync: boolean;
};

export async function GET() {
  try {
    const products = await listProducts();
    const syncStatus: ProductSyncStatus[] = [];

    for (const product of products) {
      let hasImage = false;

      // Check if product has image in Stripe
      if (product.stripePriceId) {
        try {
          const price = await stripe.prices.retrieve(product.stripePriceId, {
            expand: ["product"],
          });

          const stripeProduct = price.product as Stripe.Product;
          hasImage = stripeProduct.images && stripeProduct.images.length > 0;
        } catch (err) {
          console.error(`Failed to fetch Stripe price for ${product.slug}:`, err);
        }
      }

      const needsSync = !!product.image && !hasImage && !!product.stripePriceId;

      syncStatus.push({
        slug: product.slug,
        name: product.name,
        stripePriceId: product.stripePriceId || null,
        hasImage,
        imageUrl: product.image || null,
        needsSync,
      });
    }

    return NextResponse.json({ products: syncStatus });
  } catch (error) {
    console.error("Error fetching product sync status:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, syncAll } = body;

    if (syncAll) {
      // Sync all products that need it
      const products = await listProducts();
      let synced = 0;
      let skipped = 0;

      for (const product of products) {
        if (!product.stripePriceId || !product.image) {
          skipped++;
          continue;
        }

        try {
          // Get the price to find the product ID
          const price = await stripe.prices.retrieve(product.stripePriceId, {
            expand: ["product"],
          });

          const stripeProduct = price.product as Stripe.Product;

          // Check if already has image
          if (stripeProduct.images && stripeProduct.images.length > 0) {
            skipped++;
            continue;
          }

          // Update with image
          await stripe.products.update(stripeProduct.id, {
            images: [product.image],
          });

          synced++;
        } catch (err) {
          console.error(`Failed to sync ${product.slug}:`, err);
          skipped++;
        }
      }

      return NextResponse.json({ synced, skipped });
    } else if (slug) {
      // Sync single product
      const product = await getProductBySlug(slug);

      if (!product) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 }
        );
      }

      if (!product.stripePriceId) {
        return NextResponse.json(
          { error: "Product has no Stripe price ID" },
          { status: 400 }
        );
      }

      if (!product.image) {
        return NextResponse.json(
          { error: "Product has no image to sync" },
          { status: 400 }
        );
      }

      // Get the price to find the product ID
      const price = await stripe.prices.retrieve(product.stripePriceId, {
        expand: ["product"],
      });

      const stripeProduct = price.product as Stripe.Product;

      // Check if already has image
      if (stripeProduct.images && stripeProduct.images.length > 0) {
        return NextResponse.json({
          skipped: true,
          productName: product.name,
        });
      }

      // Update with image
      await stripe.products.update(stripeProduct.id, {
        images: [product.image],
      });

      return NextResponse.json({
        success: true,
        productName: product.name,
      });
    } else {
      return NextResponse.json(
        { error: "Must provide either slug or syncAll" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error syncing product:", error);
    return NextResponse.json(
      { error: "Failed to sync product" },
      { status: 500 }
    );
  }
}
