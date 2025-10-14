"use client";

import { useCartStore } from "@/lib/cartStore";
import type { Product } from "@/lib/productsStore";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

type Props = {
  product: Product;
  stock: number;
};

export default function ProductActions({ product, stock }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);
  const [isBuying, setIsBuying] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  const canBuy = !!product.stripePriceId && stock > 0;
  const currentQuantityInCart = getItemQuantity(product.slug);
  const remainingStock = stock - currentQuantityInCart;

  const handleAddToCart = () => {
    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
    });

    if (success) {
      setAddToCartMessage("Added to cart!");
      setTimeout(() => setAddToCartMessage(""), 2000);
    } else {
      setAddToCartMessage("Cannot add more - stock limit reached");
      setTimeout(() => setAddToCartMessage(""), 3000);
    }
  };

  const handleBuyNow = async () => {
    if (!canBuy) return;
    setIsBuying(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: [{ price: product.stripePriceId, quantity: 1 }],
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to create checkout session");
        setIsBuying(false);
      }
    } catch (error) {
      console.error("Buy now error:", error);
      alert("An error occurred");
      setIsBuying(false);
    }
  };

  return (
    <>
      <p className="mt-6 text-sm">
        {stock <= 0 ? (
          <span className="text-rose-600 font-medium">Out of stock</span>
        ) : stock < 3 ? (
          <span className="text-rose-600 font-medium">Only {stock} left — almost gone</span>
        ) : (
          <span className="text-[var(--color-muted)]">{stock} in stock</span>
        )}
        {currentQuantityInCart > 0 && (
          <span className="ml-2 text-xs text-[var(--color-muted)]">
            ({currentQuantityInCart} in cart)
          </span>
        )}
      </p>

      {addToCartMessage && (
        <p className={`mt-2 text-sm font-medium ${addToCartMessage.includes("Cannot") ? "text-rose-600" : "text-green-600"}`}>
          {addToCartMessage}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!canBuy || remainingStock <= 0}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
          border border-[var(--color-accent)]
          text-[var(--color-accent)]
          hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)]
          transition
          ${!canBuy || remainingStock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ShoppingCart className="w-4 h-4" />
          {remainingStock <= 0 && currentQuantityInCart > 0 ? "Max in Cart" : "Add to Cart"}
        </button>

        <button
          onClick={handleBuyNow}
          disabled={!canBuy || isBuying}
          className={`flex-1 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium border-0
          [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_95%,_white_5%),_color-mix(in_oklab,_var(--color-accent)_80%,_black_6%))]
          text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgba(20,16,12,0.1)]
          hover:shadow-[0_4px_16px_rgba(20,16,12,0.15)] hover:-translate-y-[1px] transition
          ${!canBuy || isBuying ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""}`}
        >
          {isBuying ? "Processing..." : "Buy Now"}
        </button>
      </div>
    </>
  );
}
