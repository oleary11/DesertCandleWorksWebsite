/**
 * Data Access Layer (DAL) Repository Interfaces
 *
 * These interfaces define the contract for data access,
 * allowing us to swap between Redis and Postgres implementations.
 */

import type {
  User,
  Order,
  PointsTransaction,
  PasswordResetToken,
  EmailVerificationToken,
  InvoiceAccessToken
} from '../userStore';

import type { Purchase, PurchaseItem } from '../purchasesStore';
import type { Promotion } from '../promotions';
import type { Refund } from '../refundStore';
import type { Product } from '../products';
import type { AlcoholType } from '../alcoholTypesStore';

// ============================================
// USER REPOSITORY
// ============================================

export interface IUserRepository {
  // User management
  createUser(email: string, password: string, firstName: string, lastName: string): Promise<User>;
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  listAllUsers(): Promise<User[]>;
  updateUserProfile(userId: string, updates: Partial<Pick<User, 'firstName' | 'lastName'>>): Promise<User>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  verifyPassword(email: string, password: string): Promise<User | null>;

  // Email verification
  createEmailVerificationToken(userId: string): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | null>;
  verifyEmailWithToken(token: string): Promise<boolean>;

  // Password reset
  createPasswordResetToken(email: string): Promise<PasswordResetToken | null>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  resetPasswordWithToken(token: string, newPassword: string): Promise<boolean>;
}

// ============================================
// ORDER REPOSITORY
// ============================================

export interface CreateOrderData {
  email: string;
  checkoutSessionId: string;
  totalCents: number;
  items: Order['items'];
  userId?: string;
  productSubtotalCents?: number;
  shippingCents?: number;
  taxCents?: number;
  paymentMethod?: string;
  notes?: string;
  shippingAddress?: Order['shippingAddress'];
  phone?: string;
}

export interface IOrderRepository {
  createOrder(data: CreateOrderData): Promise<Order>;
  getOrderById(orderId: string): Promise<Order | null>;
  getUserOrders(userId: string, limit?: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  completeOrder(orderId: string): Promise<void>;
  deleteOrder(orderId: string): Promise<void>;
  updateOrderShipping(orderId: string, trackingNumber: string, status: 'shipped' | 'delivered'): Promise<Order>;
  linkGuestOrdersToUser(email: string, userId: string): Promise<number>;

  // Invoice access for guest orders
  createInvoiceAccessToken(orderId: string): Promise<InvoiceAccessToken>;
  getInvoiceAccessToken(token: string): Promise<InvoiceAccessToken | null>;
  getOrderByToken(token: string): Promise<Order | null>;
}

// ============================================
// POINTS REPOSITORY
// ============================================

export interface IPointsRepository {
  addPoints(
    userId: string,
    amount: number,
    type: PointsTransaction['type'],
    description: string,
    orderId?: string
  ): Promise<PointsTransaction>;
  getUserPointsTransactions(userId: string, limit?: number): Promise<PointsTransaction[]>;
  redeemPoints(userId: string, amount: number, description: string): Promise<PointsTransaction>;
  deductPoints(userId: string, amount: number, description: string): Promise<PointsTransaction>;
}

// ============================================
// PRODUCT REPOSITORY
// ============================================

export interface IProductRepository {
  listProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  upsertProduct(product: Product): Promise<Product>;
  deleteProduct(slug: string): Promise<void>;
  setStock(slug: string, value: number): Promise<number>;
  incrStock(slug: string, delta: number): Promise<number>;
  setVariantStock(slug: string, variantId: string, value: number): Promise<Product>;
  incrVariantStock(slug: string, variantId: string, delta: number): Promise<Product>;
}

// ============================================
// PURCHASE REPOSITORY (Business Expenses)
// ============================================

export interface ICreatePurchaseData {
  vendorName: string;
  purchaseDate: string;
  items: PurchaseItem[];
  shippingCents: number;
  taxCents: number;
  receiptImageUrl?: string;
  notes?: string;
}

export interface IPurchaseRepository {
  createPurchase(data: ICreatePurchaseData): Promise<Purchase>;
  getPurchaseById(id: string): Promise<Purchase | null>;
  getAllPurchases(): Promise<Purchase[]>;
  getPurchasesByVendor(vendorName: string): Promise<Purchase[]>;
  getPurchasesByDateRange(startDate: string, endDate: string): Promise<Purchase[]>;
  updatePurchase(id: string, updates: Partial<Omit<Purchase, 'id' | 'createdAt'>>): Promise<Purchase | null>;
  deletePurchase(id: string): Promise<boolean>;
  getVendors(): Promise<string[]>;
  getSpendingByCategory(): Promise<Record<string, number>>;
  getSpendingByVendor(): Promise<Record<string, number>>;
}

// ============================================
// PROMOTION REPOSITORY
// ============================================

export interface IPromotionRepository {
  createPromotion(promotion: Promotion): Promise<void>;
  getPromotionById(id: string): Promise<Promotion | null>;
  getPromotionByCode(code: string): Promise<Promotion | null>;
  listPromotions(): Promise<Promotion[]>;
  updatePromotion(id: string, updates: Partial<Promotion>): Promise<void>;
  deletePromotion(id: string): Promise<void>;
  incrementRedemptions(id: string): Promise<void>;
}

// ============================================
// REFUND REPOSITORY
// ============================================

export interface IRefundRepository {
  createRefund(refund: Refund): Promise<Refund>;
  getRefundById(id: string): Promise<Refund | null>;
  listRefunds(): Promise<Refund[]>;
  getRefundsByOrderId(orderId: string): Promise<Refund[]>;
  updateRefundStatus(
    id: string,
    status: Refund['status'],
    stripeRefundId?: string,
    processedAt?: string
  ): Promise<Refund | null>;
  getOrderRefundTotal(orderId: string): Promise<number>;
}

// ============================================
// ALCOHOL TYPE REPOSITORY
// ============================================

export interface IAlcoholTypeRepository {
  getAlcoholTypes(): Promise<AlcoholType[]>;
  getActiveAlcoholTypes(): Promise<AlcoholType[]>;
  addAlcoholType(name: string, sortOrder?: number): Promise<AlcoholType>;
  updateAlcoholType(id: string, updates: Partial<AlcoholType>): Promise<AlcoholType | null>;
  updateAlcoholTypesMany(updates: Array<Partial<AlcoholType> & { id: string }>): Promise<AlcoholType[]>;
  setAlcoholTypeArchived(id: string, archived: boolean): Promise<AlcoholType | null>;
  deleteAlcoholType(id: string): Promise<boolean>;
}

// ============================================
// WEBHOOK DEDUPLICATION
// ============================================

export interface IWebhookRepository {
  isWebhookProcessed(eventId: string): Promise<boolean>;
  markWebhookProcessed(eventId: string): Promise<void>;
}
