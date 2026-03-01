"use client";

import { useCartStore } from "@/lib/cartStore";
import type { Product } from "@/lib/productsStore";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useModal } from "@/hooks/useModal";
import { trackEvent } from "@/components/AnalyticsTracker";

type Props = {
  product: Product;
  stock: number;
};

export default function ProductActions({ product, stock }: Props) {
  const { showAlert } = useModal();
  const addItem = useCartStore((state) => state.addItem);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);
  const [isBuying, setIsBuying] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");

  const canBuy = !!product.stripePriceId && stock > 0;
  const currentQuantityInCart = getItemQuantity(product.slug);
  const remainingStock = stock - currentQuantityInCart;

  const handleAddToCart = () => {
    setIsAddingToCart(true);

    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
    });

    if (success) {
      trackEvent("cart_add", {
        productSlug: product.slug,
        productName: product.name,
        priceCents: Math.round(product.price * 100),
      });
      setAddToCartMessage("Added to cart!");
      setTimeout(() => {
        setAddToCartMessage("");
        setIsAddingToCart(false);
      }, 1500);
    } else {
      setAddToCartMessage("Cannot add more - stock limit reached");
      setTimeout(() => {
        setAddToCartMessage("");
        setIsAddingToCart(false);
      }, 2500);
    }
  };

  const handleBuyNow = async () => {
    if (!canBuy) return;
    setIsBuying(true);

    // Add item to cart
    const success = addItem({
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      stripePriceId: product.stripePriceId!,
      maxStock: stock,
    });

    if (success) {
      // Redirect to cart page
      window.location.href = "/cart";
    } else {
      await showAlert("Cannot add more - stock limit reached", "Error");
      setIsBuying(false);
    }
  };

  return (
    <>
      <p className="mt-6 text-sm">
        {stock <= 0 ? (
          <span className="text-rose-600 font-medium">Out of stock</span>
        ) : stock === 1 ? (
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
          disabled={!canBuy || remainingStock <= 0 || isAddingToCart}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium
          border-2 !border-[var(--color-accent)]
          text-[var(--color-accent)]
          hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)]
          transition
          ${!canBuy || remainingStock <= 0 || isAddingToCart ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {!isAddingToCart && <ShoppingCart className="w-4 h-4" />}
          {isAddingToCart ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            </>
          ) : remainingStock <= 0 && currentQuantityInCart > 0 ? (
            "Max in Cart"
          ) : (
            "Add to Cart"
          )}
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
