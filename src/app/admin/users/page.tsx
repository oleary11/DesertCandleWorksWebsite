"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, Shield, User, Clock, CheckCircle, XCircle } from "lucide-react";

interface AdminUserPublic {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
  active: boolean;
  role: "super_admin" | "admin";
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        // If 401, user might not be super admin or not logged in
        if (res.status === 401) {
          setError("You must be a super admin to manage users");
        } else {
          throw new Error("Failed to load users");
        }
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError("Failed to load admin users");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading admin users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Users</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Manage admin accounts and permissions
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create Admin User
            </button>
          </div>
        </div>

        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}

        {/* Users List */}
        <div className="card p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">Admin Accounts ({users.length})</h2>

          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--color-muted)] mb-4">No admin users yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Create First Admin
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="card p-4 bg-neutral-50 border border-[var(--color-line)] hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {user.role === "super_admin" ? (
                          <Shield className="w-4 h-4 text-purple-600" />
                        ) : (
                          <User className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="font-semibold">{user.email}</span>
                        {!user.active && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Deactivated
                          </span>
                        )}
                        {user.role === "super_admin" && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            Super Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created: {formatDate(user.createdAt)}
                        </div>
                        {user.lastLoginAt && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Last login: {formatDate(user.lastLoginAt)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.active ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <CreateAdminModal
          onClose={() => {
            setShowCreateModal(false);
            setTwoFactorSetup(null);
            loadUsers(); // Reload users when modal closes
          }}
          onSuccess={(setup) => {
            setTwoFactorSetup(setup);
            loadUsers();
          }}
          twoFactorSetup={twoFactorSetup}
        />
      )}
    </div>
  );
}

interface CreateAdminModalProps {
  onClose: () => void;
  onSuccess: (setup: TwoFactorSetup) => void;
  twoFactorSetup: TwoFactorSetup | null;
}

function CreateAdminModal({ onClose, onSuccess, twoFactorSetup }: CreateAdminModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create admin user");
      }

      // Reset form
      setEmail("");
      setPassword("");
      setRole("admin");

      onSuccess(data.twoFactorSetup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin user");
    } finally {
      setSubmitting(false);
    }
  }

  if (twoFactorSetup) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">Admin User Created Successfully</h2>
              <p className="text-sm text-[var(--color-muted)] mt-0.5">
                Save these 2FA details securely
              </p>
            </div>
            <button
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              onClick={onClose}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="text-sm text-blue-900">
                <strong>Important:</strong> Provide this information to the new admin. They will need to scan
                the QR code with their authenticator app (Google Authenticator, Authy, etc.) and save the
                backup codes in a secure location.
              </p>
            </div>

            {/* QR Code */}
            <div className="text-center">
              <h3 className="font-semibold mb-2">Scan this QR code with authenticator app:</h3>
              <img
                src={twoFactorSetup.qrCodeUrl}
                alt="2FA QR Code"
                className="mx-auto border border-[var(--color-line)] p-2 rounded"
              />
            </div>

            {/* Secret (manual entry) */}
            <div>
              <h3 className="font-semibold mb-2">Or enter this secret manually:</h3>
              <code className="block p-3 bg-neutral-100 rounded text-sm font-mono break-all">
                {twoFactorSetup.secret}
              </code>
            </div>

            {/* Backup Codes */}
            <div>
              <h3 className="font-semibold mb-2">Backup Codes (save these securely):</h3>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded mb-2">
                <p className="text-sm text-amber-900">
                  ⚠️ Each backup code can only be used once. Store these in a secure password manager.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {twoFactorSetup.backupCodes.map((code, i) => (
                  <code key={i} className="block p-2 bg-neutral-100 rounded text-sm font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-neutral-200 bg-neutral-50">
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">Create Admin User</h2>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Add a new administrator with 2FA enabled
            </p>
          </div>
          <button
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <label className="block">
            <div className="text-sm font-medium mb-1">Email</div>
            <input
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-1">Password</div>
            <input
              type="password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Minimum 12 characters
            </p>
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-1">Role</div>
            <select
              className="input w-full"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "super_admin")}
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Super admins can manage other admin users
            </p>
          </label>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-sm text-rose-900">{error}</p>
            </div>
          )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
            <button
              type="button"
              onClick={onClose}
              className="btn hover:bg-white transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
