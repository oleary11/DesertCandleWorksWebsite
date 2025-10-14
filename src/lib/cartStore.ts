import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  productSlug: string;
  productName: string;
  productImage?: string;
  price: number;
  stripePriceId: string;
  quantity: number;
  maxStock: number; // Track available stock
  // For variant products
  variantId?: string;
  wickType?: string;
  scent?: string;
  wickTypeName?: string;
  scentName?: string;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => boolean; // Returns true if successfully added
  removeItem: (productSlug: string, variantId?: string) => void;
  updateQuantity: (productSlug: string, quantity: number, variantId?: string) => boolean; // Returns true if successfully updated
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemQuantity: (productSlug: string, variantId?: string) => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        const state = get();
        const existingItemIndex = state.items.findIndex(
          (item) =>
            item.productSlug === newItem.productSlug &&
            item.variantId === newItem.variantId
        );

        if (existingItemIndex > -1) {
          // Item exists, check if we can increment quantity
          const existingItem = state.items[existingItemIndex];
          if (existingItem.quantity >= newItem.maxStock) {
            // Already at max stock, can't add more
            return false;
          }
          const updatedItems = [...state.items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: existingItem.quantity + 1,
            maxStock: newItem.maxStock, // Update stock in case it changed
          };
          set({ items: updatedItems });
          return true;
        } else {
          // New item, check if stock > 0
          if (newItem.maxStock <= 0) {
            return false;
          }
          set({ items: [...state.items, { ...newItem, quantity: 1 }] });
          return true;
        }
      },

      removeItem: (productSlug, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (item) =>
              !(item.productSlug === productSlug && item.variantId === variantId)
          ),
        }));
      },

      updateQuantity: (productSlug, quantity, variantId) => {
        const state = get();
        const item = state.items.find(
          (item) => item.productSlug === productSlug && item.variantId === variantId
        );

        if (!item) return false;

        if (quantity <= 0) {
          // Remove item if quantity is 0 or less
          set({
            items: state.items.filter(
              (item) =>
                !(item.productSlug === productSlug && item.variantId === variantId)
            ),
          });
          return true;
        }

        // Check if quantity exceeds stock
        if (quantity > item.maxStock) {
          return false;
        }

        const updatedItems = state.items.map((item) =>
          item.productSlug === productSlug && item.variantId === variantId
            ? { ...item, quantity }
            : item
        );
        set({ items: updatedItems });
        return true;
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },

      getItemQuantity: (productSlug, variantId) => {
        const item = get().items.find(
          (item) => item.productSlug === productSlug && item.variantId === variantId
        );
        return item?.quantity || 0;
      },
    }),
    {
      name: 'desert-candle-cart',
    }
  )
);
