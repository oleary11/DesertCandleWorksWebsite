"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, ShoppingBag, Award, LogOut } from "lucide-react";

type UserData = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  points: number;
  emailVerified: boolean;
  createdAt: string;
};

type Order = {
  id: string;
  totalCents: number;
  pointsEarned: number;
  status: string;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
  completedAt?: string;
};

type PointsTransaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "points" | "settings">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Password change
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete account
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Email verification
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  // Set active tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "orders" || tab === "points" || tab === "settings") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [userRes, ordersRes, pointsRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/user/orders", { cache: "no-store" }),
        fetch("/api/user/points", { cache: "no-store" }),
      ]);

      if (!userRes.ok) {
        router.push("/account/login");
        return;
      }

      const userData = await userRes.json();
      const ordersData = await ordersRes.json();
      const pointsData = await pointsRes.json();

      setUser(userData.user);
      setOrders(ordersData.orders || []);
      setTransactions(pointsData.transactions || []);
      setLoading(false);
    } catch (err) {
      setError("Failed to load account data");
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password");
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError("Network error. Please try again.");
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      alert("Please enter your password");
      return;
    }

    if (!confirm("Are you sure? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete account");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      alert("Network error. Please try again.");
    }
  }

  async function handleResendVerification() {
    setSendingVerification(true);
    setVerificationMessage("");

    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setVerificationMessage(data.error || "Failed to send verification email");
        setSendingVerification(false);
        return;
      }

      setVerificationMessage("Verification email sent! Check your inbox.");
      setSendingVerification(false);
    } catch (err) {
      setVerificationMessage("Network error. Please try again.");
      setSendingVerification(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-[var(--color-muted)]">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[80vh] px-6 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">
            Welcome back, {user.firstName}!
          </h1>
          <p className="text-[var(--color-muted)]">Manage your account and track your rewards</p>
        </div>

        {/* Email Verification Banner */}
        {!user.emailVerified && (
          <div className="card p-4 mb-6 bg-blue-50 border-blue-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">Verify your email</p>
                <p className="text-xs text-blue-700">
                  Please verify your email address to ensure you receive important updates about your orders and points.
                </p>
                {verificationMessage && (
                  <p className="text-xs mt-2 text-blue-800 font-medium">{verificationMessage}</p>
                )}
              </div>
              <button
                onClick={handleResendVerification}
                disabled={sendingVerification}
                className="text-xs bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
              >
                {sendingVerification ? "Sending..." : "Resend Email"}
              </button>
            </div>
          </div>
        )}

        {/* Points Banner */}
        <div className="card p-6 mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-muted)] mb-1">Your Points Balance</p>
              <p className="text-4xl font-bold text-[var(--color-accent)]">
                {user.points.toLocaleString()}
              </p>
              <p className="text-sm text-[var(--color-muted)] mt-2">
                = ${(user.points / 100).toFixed(2)} in rewards
              </p>
            </div>
            <Award className="w-16 h-16 text-[var(--color-accent)] opacity-20" />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--color-line)] mb-8">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
                activeTab === "overview"
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
                activeTab === "orders"
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab("points")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
                activeTab === "points"
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Points History
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
                activeTab === "settings"
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Account Info */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-semibold">Account Information</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[var(--color-muted)] mb-1">Name</p>
                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)] mb-1">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)] mb-1">Member Since</p>
                  <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <ShoppingBag className="w-5 h-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-semibold">Recent Orders</h2>
              </div>
              {orders.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No orders yet</p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="text-sm border-b border-[var(--color-line)] pb-3 last:border-0">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">${(order.totalCents / 100).toFixed(2)}</span>
                        <span className="text-[var(--color-muted)]">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)]">
                        {order.items.length} item(s) · {order.pointsEarned} points earned
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="card p-12 text-center">
                <ShoppingBag className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4" />
                <p className="text-[var(--color-muted)] mb-4">No orders yet</p>
                <Link href="/shop" className="btn btn-primary !text-white">
                  Start Shopping
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-semibold text-lg">${(order.totalCents / 100).toFixed(2)}</p>
                      <p className="text-sm text-[var(--color-muted)]">
                        Order #{order.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {order.status}
                      </span>
                      <p className="text-sm text-[var(--color-muted)] mt-1">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-[var(--color-line)] pt-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-2">
                        <div>
                          <Link href={`/shop/${item.productSlug}`} className="hover:underline">
                            {item.productName}
                          </Link>
                          <span className="text-[var(--color-muted)] ml-2">x{item.quantity}</span>
                        </div>
                        <span>${(item.priceCents / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--color-line)] flex items-center gap-2 text-sm">
                    <Award className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="font-medium text-[var(--color-accent)]">
                      +{order.pointsEarned} points earned
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "points" && (
          <div>
            {transactions.length === 0 ? (
              <div className="card p-12 text-center">
                <Award className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4" />
                <p className="text-[var(--color-muted)]">No points transactions yet</p>
              </div>
            ) : (
              <div className="card p-6">
                <div className="space-y-4">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center py-3 border-b border-[var(--color-line)] last:border-0">
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {new Date(tx.createdAt).toLocaleDateString()} at{" "}
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Change Password</h2>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    Password changed successfully!
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary !text-white">
                  Update Password
                </button>
              </form>
            </div>

            {/* Logout */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Sign Out</h2>
              <button
                onClick={handleLogout}
                className="btn flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>

            {/* Delete Account */}
            <div className="card p-6 border-red-200">
              <h2 className="text-lg font-semibold mb-2 text-red-600">Danger Zone</h2>
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Once you delete your account, there is no going back. Your order history will be preserved but you won&apos;t be able to access it.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn text-red-600 border-red-200 hover:bg-red-50"
                >
                  Delete Account
                </button>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-2">Enter your password to confirm</label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="input"
                      placeholder="Password"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      className="btn bg-red-600 text-white hover:bg-red-700"
                    >
                      Confirm Deletion
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                      }}
                      className="btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AccountPageContent />
    </Suspense>
  );
}
