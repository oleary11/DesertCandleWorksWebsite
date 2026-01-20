"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Printer, AlertCircle } from "lucide-react";

type Order = {
  id: string;
  userId?: string;
  email: string;
  totalCents: number;
  productSubtotalCents?: number;
  shippingCents?: number;
  taxCents?: number;
  pointsEarned: number;
  status: string;
  isGuest: boolean;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
  completedAt?: string;
};

function InvoiceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvoice() {
      if (!token) {
        setError("Invalid or missing invoice link");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/invoice/view?token=${token}`);

        if (!res.ok) {
          if (res.status === 404) {
            setError("Invoice not found or link has expired");
            return;
          }
          throw new Error("Failed to load invoice");
        }

        const data = await res.json();
        setOrder(data.order);
      } catch {
        setError("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--color-muted)]">Loading invoice...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <AlertCircle className="w-16 h-16 text-rose-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Invoice Not Available</h1>
        <p className="text-[var(--color-muted)] mb-4 text-center max-w-md">
          {error || "Invoice not found"}
        </p>
        {order?.isGuest && (
          <div className="card p-6 max-w-md mt-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <p className="text-sm font-semibold text-amber-900 mb-2">
              💡 Want to access your invoices anytime?
            </p>
            <p className="text-xs text-amber-800 mb-3">
              Create an account to view all your order history and earn points on future purchases.
            </p>
            <Link
              href="/account/register"
              className="inline-flex items-center text-xs font-medium text-amber-900 hover:text-amber-950 underline"
            >
              Create Account →
            </Link>
          </div>
        )}
        <Link href="/" className="btn mt-6">
          Back to Home
        </Link>
      </div>
    );
  }

  // Calculate totals
  const subtotal = order.productSubtotalCents ?? order.totalCents;
  const shipping = order.shippingCents ?? 0;
  const tax = order.taxCents ?? 0;
  const total = order.totalCents;

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .invoice-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="min-h-screen bg-neutral-50 py-8 px-6">
        <div className="invoice-container max-w-4xl mx-auto">
          {/* Header Actions - Hidden on print */}
          <div className="no-print mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
            >
              ← Back to Home
            </Link>
            <button
              onClick={handlePrint}
              className="btn inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>

          {/* Encourage Account Creation Banner - Hidden on print */}
          {order.isGuest && (
            <div className="no-print card p-6 mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  💡
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-1">
                    Create an account to access your invoices anytime!
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    Get access to your complete order history, earn points on purchases, and enjoy exclusive perks.
                    You could have earned <strong>{order.pointsEarned} points</strong> (${((order.pointsEarned * 5) / 100).toFixed(2)} value) on this order!
                  </p>
                  <Link
                    href="/account/register"
                    className="inline-flex items-center text-sm font-medium text-amber-900 hover:text-amber-950 underline"
                  >
                    Create Your Free Account →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Card */}
          <div className="card p-8 md:p-12 bg-white">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-12">
              <div>
                <h1 className="text-3xl font-bold text-[var(--color-ink)] mb-2">INVOICE</h1>
                <p className="text-[var(--color-muted)] text-sm">
                  Invoice #{order.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-[var(--color-muted)] text-sm">
                  Date: {new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              {/* Business Info */}
              <div className="text-right">
                <h2 className="text-xl font-semibold mb-1">Desert Candle Works</h2>
                <p className="text-sm text-[var(--color-muted)]">Scottsdale, AZ</p>
                <p className="text-sm text-[var(--color-muted)]">www.desertcandleworks.com</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-12">
              <h3 className="text-sm font-semibold text-[var(--color-muted)] uppercase mb-2">Bill To</h3>
              <p className="text-[var(--color-ink)] font-medium">{order.email}</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Order ID: {order.id}
              </p>
            </div>

            {/* Items Table - Desktop */}
            <div className="mb-8 hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[var(--color-line)]">
                    <th className="text-left py-3 font-semibold text-sm text-[var(--color-muted)] uppercase">
                      Item
                    </th>
                    <th className="text-center py-3 font-semibold text-sm text-[var(--color-muted)] uppercase">
                      Qty
                    </th>
                    <th className="text-right py-3 font-semibold text-sm text-[var(--color-muted)] uppercase">
                      Price
                    </th>
                    <th className="text-right py-3 font-semibold text-sm text-[var(--color-muted)] uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[var(--color-line)]">
                      <td className="py-4 text-[var(--color-ink)]">{item.productName}</td>
                      <td className="py-4 text-center text-[var(--color-muted)]">{item.quantity}</td>
                      <td className="py-4 text-right text-[var(--color-muted)]">
                        ${(item.priceCents / item.quantity / 100).toFixed(2)}
                      </td>
                      <td className="py-4 text-right font-medium">
                        ${(item.priceCents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Items List - Mobile */}
            <div className="mb-8 md:hidden space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-4 border border-[var(--color-line)] rounded-lg">
                  <div className="font-medium text-[var(--color-ink)] mb-3">{item.productName}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Quantity:</span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Price:</span>
                      <span className="font-medium">${(item.priceCents / item.quantity / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-3 pt-3 border-t border-[var(--color-line)] font-semibold">
                    <span>Total:</span>
                    <span>${(item.priceCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-12">
              <div className="w-full md:w-1/2 space-y-2">
                <div className="flex justify-between text-sm py-2">
                  <span className="text-[var(--color-muted)]">Subtotal:</span>
                  <span className="font-medium">${(subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm py-2">
                  <span className="text-[var(--color-muted)]">Shipping:</span>
                  <span className="font-medium">{shipping === 0 ? 'FREE' : `$${(shipping / 100).toFixed(2)}`}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm py-2">
                    <span className="text-[var(--color-muted)]">Tax:</span>
                    <span className="font-medium">${(tax / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold py-3 border-t-2 border-[var(--color-line)]">
                  <span>Total:</span>
                  <span>${(total / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="border-t border-[var(--color-line)] pt-6">
              <h3 className="text-sm font-semibold text-[var(--color-muted)] uppercase mb-2">Payment Method</h3>
              <p className="text-[var(--color-ink)]">Paid via Stripe</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Status: <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  {order.status}
                </span>
              </p>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-[var(--color-line)] text-center text-sm text-[var(--color-muted)]">
              <p>Thank you for your business!</p>
              <p className="mt-2">
                Questions? Contact us at contact@desertcandleworks.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PublicInvoicePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--color-muted)]">Loading invoice...</p>
      </div>
    }>
      <InvoiceContent />
    </Suspense>
  );
}
