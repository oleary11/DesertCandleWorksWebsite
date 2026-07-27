import { NextResponse } from "next/server";
import Stripe from "stripe";
import { listProducts, upsertProduct, type HomeGoodsBottleOption } from "@/lib/productsStore";

export const runtime = "nodejs";

export async function POST() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });
  const products = (await listProducts()).filter(
    (product) => product.productType === "home_goods" && product.stripePriceId && product.bottleOptions?.length,
  );

  let synced = 0;
  let pricesCreated = 0;
  let pricesDeactivated = 0;
  const errors: Array<{ slug: string; error: string }> = [];

  for (const product of products) {
    try {
      const basePrice = await stripe.prices.retrieve(product.stripePriceId!, { expand: ["product"] });
      const stripeProduct = basePrice.product as Stripe.Product;
      const existingPrices = await stripe.prices.list({ product: stripeProduct.id, limit: 100 });
      const byBottleId = new Map(
        existingPrices.data
          .filter((price) => price.metadata.bottleId)
          .map((price) => [price.metadata.bottleId, price]),
      );
      const selectedBottleIds = new Set(product.bottleOptions!.map((option) => option.bottleId));
      const updatedOptions: HomeGoodsBottleOption[] = [];

      for (const option of product.bottleOptions!) {
        const desiredAmount = option.priceCents && option.priceCents > 0
          ? option.priceCents
          : Math.round(product.price * 100);
        let existing = byBottleId.get(option.bottleId);

        if (!existing && option.stripePriceId) {
          existing = existingPrices.data.find((price) => price.id === option.stripePriceId);
        }

        if (existing?.active && existing.unit_amount === desiredAmount) {
          updatedOptions.push({ ...option, stripePriceId: existing.id });
          continue;
        }

        const replacement = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: desiredAmount,
          currency: "usd",
          nickname: option.bottleName,
          metadata: {
            productName: product.name,
            productSlug: product.slug,
            bottleId: option.bottleId,
            bottleName: option.bottleName,
          },
        });
        pricesCreated++;

        if (existing?.active) {
          await stripe.prices.update(existing.id, { active: false });
          pricesDeactivated++;
        }
        updatedOptions.push({ ...option, stripePriceId: replacement.id });
      }

      for (const price of existingPrices.data) {
        const bottleId = price.metadata.bottleId;
        if (price.active && bottleId && !selectedBottleIds.has(bottleId)) {
          await stripe.prices.update(price.id, { active: false });
          pricesDeactivated++;
        }
      }

      const images = product.images?.length ? product.images : product.image ? [product.image] : [];
      await stripe.products.update(stripeProduct.id, {
        name: product.name,
        description: product.seoDescription || undefined,
        images: images.slice(0, 8),
      });

      await upsertProduct({
        ...product,
        stripePriceId: updatedOptions[0]?.stripePriceId || product.stripePriceId,
        bottleOptions: updatedOptions,
      });
      synced++;
    } catch (error) {
      errors.push({ slug: product.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({
    total: products.length,
    synced,
    failed: errors.length,
    pricesCreated,
    pricesDeactivated,
    errors,
  });
}