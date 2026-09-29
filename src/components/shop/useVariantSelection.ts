"use client";

import { useCallback, useMemo, useState } from "react";
import type { Product, ProductVariant } from "@/lib/products";
import { getPrimaryImage } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import type { CartItem } from "@/lib/cartStore";
import { useCartStore } from "@/lib/cartStore";

export type ScentGroup = "favorites" | "seasonal" | "limited";

export const SCENT_GROUP_LABEL: Record<ScentGroup, string> = {
  favorites: "Signature",
  seasonal: "Seasonal",
  limited: "Limited",
};

function groupOf(scent: GlobalScent): ScentGroup {
  if (scent.limited) return "limited";
  if (scent.seasonal) return "seasonal";
  return "favorites";
}

/**
 * Size / wick / scent selection for a candle, shared by the product page and
 * the quick-add dialog so both behave identically and build identical cart items.
 *
 * `scents` may be the full global list (shop grid) or the product's list
 * (product page); limited scents are narrowed to this product either way,
 * matching getScentsForProduct().
 */
export function useVariantSelection(product: Product, variants: ProductVariant[], scents: GlobalScent[]) {
  const sizes = useMemo(() => product.variantConfig?.sizes ?? [], [product.variantConfig]);
  const wickTypes = useMemo(() => product.variantConfig?.wickTypes ?? [], [product.variantConfig]);
  const hasSizes = sizes.length > 0;

  const productScents = useMemo(
    () => scents.filter((s) => !s.limited || (s.enabledProducts?.includes(product.slug) ?? false)),
    [scents, product.slug]
  );
  const scentById = useMemo(() => new Map(productScents.map((s) => [s.id, s])), [productScents]);
  const scentsByGroup = useMemo(() => {
    const groups: Record<ScentGroup, GlobalScent[]> = { favorites: [], seasonal: [], limited: [] };
    for (const s of productScents) groups[groupOf(s)].push(s);
    return groups;
  }, [productScents]);

  const variantFor = useCallback(
    (size: string | undefined, wick: string, scent: string) =>
      variants.find((v) => (!hasSizes || v.size === size) && v.wickType === wick && v.scent === scent),
    [variants, hasSizes]
  );
  const inStock = useCallback(
    (size: string | undefined, wick: string, scent: string) => (variantFor(size, wick, scent)?.stock ?? 0) > 0,
    [variantFor]
  );

  /** Best valid combination, keeping as much of the requested choice as stock allows. */
  const resolve = useCallback(
    (want: { size?: string; wick?: string; group?: ScentGroup; scent?: string }) => {
      const sizeOrder = hasSizes ? [want.size, ...sizes.map((s) => s.id)].filter(Boolean) as string[] : [undefined];
      const wickOrder = [want.wick, ...wickTypes.map((w) => w.id)].filter(Boolean) as string[];
      const groupOrder = [want.group, "favorites", "seasonal", "limited"].filter(Boolean) as ScentGroup[];

      for (const size of sizeOrder) {
        for (const wick of wickOrder) {
          if (want.scent && scentById.has(want.scent) && inStock(size, wick, want.scent)) {
            return { size, wick, group: groupOf(scentById.get(want.scent)!), scent: want.scent };
          }
          for (const group of groupOrder) {
            const hit = scentsByGroup[group].find((s) => inStock(size, wick, s.id));
            if (hit) return { size, wick, group, scent: hit.id };
          }
        }
      }
      // Nothing in stock: keep the request, filled in with first options, so the UI still shows something.
      const group = want.group ?? (["favorites", "seasonal", "limited"] as ScentGroup[]).find((g) => scentsByGroup[g].length > 0) ?? "favorites";
      return {
        size: want.size ?? sizes[0]?.id,
        wick: want.wick ?? wickTypes[0]?.id ?? "",
        group,
        scent: want.scent ?? scentsByGroup[group][0]?.id ?? productScents[0]?.id ?? "",
      };
    },
    [hasSizes, sizes, wickTypes, scentById, scentsByGroup, productScents, inStock]
  );

  const [selection, setSelection] = useState(() => resolve({}));

  const selectSize = (size: string) => setSelection((cur) => resolve({ ...cur, size }));
  const selectWick = (wick: string) => setSelection((cur) => resolve({ ...cur, wick }));
  const selectGroup = (group: ScentGroup) => setSelection((cur) => resolve({ size: cur.size, wick: cur.wick, group }));
  const selectScent = (scent: string) => setSelection((cur) => ({ ...cur, scent, group: scentById.has(scent) ? groupOf(scentById.get(scent)!) : cur.group }));

  const selectedVariant = variantFor(selection.size, selection.wick, selection.scent);
  const stock = selectedVariant?.stock ?? 0;

  const sizeAvailable = (size: string) =>
    variants.some((v) => v.size === size && v.stock > 0 && scentById.has(v.scent));
  const wickAvailable = (wick: string) =>
    variants.some((v) => (!hasSizes || v.size === selection.size) && v.wickType === wick && v.stock > 0 && scentById.has(v.scent));
  const groupAvailable = (group: ScentGroup) => scentsByGroup[group].some((s) => inStock(selection.size, selection.wick, s.id));
  const scentAvailable = (scent: string) => inStock(selection.size, selection.wick, scent);

  const visibleGroups = (["favorites", "seasonal", "limited"] as ScentGroup[]).filter((g) => scentsByGroup[g].length > 0);

  const size = sizes.find((s) => s.id === selection.size);
  const wick = wickTypes.find((w) => w.id === selection.wick);
  const scent = scentById.get(selection.scent);

  const price = selectedVariant ? selectedVariant.priceCents / 100 : size ? size.priceCents / 100 : product.price;
  const stripePriceId = selectedVariant?.stripePriceId || product.stripePriceId;

  const quantityInCart = useCartStore((state) => state.getItemQuantity(product.slug, selectedVariant?.id));
  const remaining = stock - quantityInCart;
  const canBuy = !!stripePriceId && !!selectedVariant && stock > 0;

  /** Cart line for the current selection, with ids AND display names (the cart and Stripe show the names). */
  function cartItem(): Omit<CartItem, "quantity"> | null {
    if (!canBuy || !selectedVariant || !stripePriceId) return null;
    return {
      productSlug: product.slug,
      productName: product.name,
      productImage: getPrimaryImage(product),
      price,
      stripePriceId,
      maxStock: stock,
      variantId: selectedVariant.id,
      size: selectedVariant.size,
      sizeName: size?.name,
      wickType: selectedVariant.wickType,
      wickTypeName: wick?.name,
      scent: selectedVariant.scent,
      scentName: scent?.name,
    };
  }

  return {
    sizes,
    wickTypes,
    hasSizes,
    scentsByGroup,
    visibleGroups,
    productScents,
    selection,
    selectSize,
    selectWick,
    selectGroup,
    selectScent,
    sizeAvailable,
    wickAvailable,
    groupAvailable,
    scentAvailable,
    selectedVariant,
    size,
    wick,
    scent,
    stock,
    price,
    canBuy,
    quantityInCart,
    remaining,
    cartItem,
  };
}

export type VariantSelection = ReturnType<typeof useVariantSelection>;
