"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TwoFactorSetup {
  qrCodeUrl: string;
  backupCodes: string[];
  secret: string;
}

export default function AdminSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    checkTwoFactorStatus();
  }, []);

  async function checkTwoFactorStatus() {
    try {
      const res = await fetch("/api/admin/2fa/status");
      if (res.ok) {
        const data = await res.json();
        setTwoFactorEnabled(data.enabled);
      }
    } catch (err) {
      console.error("Failed to check 2FA status:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable2FA() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/2fa/setup", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setSetupData(data);
        setSuccess("Scan the QR code with your authenticator app");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to setup 2FA");
      }
    } catch (err) {
      setError("An error occurred while setting up 2FA");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndEnable() {
    setError("");
    setLoading(true);

    try {
      // Verify the code works
      const res = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });

      if (res.ok) {
        setTwoFactorEnabled(true);
        setShowBackupCodes(true);
        setSuccess("2FA enabled successfully! Save your backup codes.");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid verification code");
      }
    } catch (err) {
      setError("An error occurred while verifying the code");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable2FA() {
    if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) {
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/2fa/disable", {
        method: "POST",
      });

      if (res.ok) {
        setTwoFactorEnabled(false);
        setSetupData(null);
        setShowBackupCodes(false);
        setSuccess("2FA disabled successfully");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to disable 2FA");
      }
    } catch (err) {
      setError("An error occurred while disabling 2FA");
    } finally {
      setLoading(false);
    }
  }

  function copyBackupCodes() {
    if (setupData?.backupCodes) {
      navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
      setSuccess("Backup codes copied to clipboard!");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  function downloadBackupCodes() {
    if (setupData?.backupCodes) {
      const blob = new Blob([setupData.backupCodes.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "desert-candle-works-2fa-backup-codes.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (loading && !setupData) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6">Settings</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <button
            onClick={() => router.push("/admin")}
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← Back to Admin
          </button>
        </div>

        {/* 2FA Section */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Two-Factor Authentication (2FA)</h2>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Add an extra layer of security to your admin account
              </p>
            </div>
            {twoFactorEnabled && !setupData && (
              <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Enabled
              </span>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              {success}
            </div>
          )}

          {!twoFactorEnabled && !setupData && (
            <div>
              <p className="text-sm mb-4">
                Two-factor authentication is currently disabled. Enable it to require both your password
                and a code from your phone when logging in.
              </p>
              <button
                onClick={handleEnable2FA}
                disabled={loading}
                className="btn btn-primary"
              >
                Enable 2FA
              </button>
            </div>
          )}

          {setupData && !showBackupCodes && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900 font-medium mb-2">⚠️ Important Setup Steps:</p>
                <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                  <li>Scan the QR code below with your authenticator app</li>
                  <li>Enter the 6-digit code from your app to verify</li>
                  <li>Save your backup codes in a secure location</li>
                </ol>
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-6 bg-white rounded-lg border">
                <img
                  src={setupData.qrCodeUrl}
                  alt="2FA QR Code"
                  className="w-64 h-64"
                />
              </div>

              {/* Manual entry option */}
              <details className="text-sm">
                <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                  Can&apos;t scan? Enter manually
                </summary>
                <div className="mt-2 p-3 bg-neutral-50 rounded border font-mono text-xs break-all">
                  {setupData.secret}
                </div>
              </details>

              {/* Verification */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Verify by entering the code from your app:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="input flex-1 font-mono text-lg tracking-widest text-center"
                    maxLength={6}
                  />
                  <button
                    onClick={handleVerifyAndEnable}
                    disabled={loading || verificationCode.length !== 6}
                    className="btn btn-primary"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            </div>
          )}

          {showBackupCodes && setupData && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-900 font-medium mb-2">🔒 Save Your Backup Codes</p>
                <p className="text-sm text-rose-800">
                  These codes can be used to log in if you lose access to your authenticator app.
                  Each code can only be used once. Store them somewhere safe!
                </p>
              </div>

              <div className="p-4 bg-neutral-50 border rounded-lg">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, idx) => (
                    <div key={idx} className="p-2 bg-white border rounded">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={copyBackupCodes} className="btn">
                  Copy Codes
                </button>
                <button onClick={downloadBackupCodes} className="btn">
                  Download as File
                </button>
                <button
                  onClick={() => {
                    setSetupData(null);
                    setShowBackupCodes(false);
                  }}
                  className="btn btn-primary ml-auto"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {twoFactorEnabled && !setupData && (
            <div>
              <p className="text-sm mb-4">
                Two-factor authentication is enabled. You&apos;ll need your authenticator app code when logging in.
              </p>
              <button
                onClick={handleDisable2FA}
                disabled={loading}
                className="btn text-rose-600 border-rose-600 hover:bg-rose-50"
              >
                Disable 2FA
              </button>
            </div>
          )}
        </div>

        {/* Recommended Apps */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Recommended Authenticator Apps</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-1">Google Authenticator</h3>
              <p className="text-[var(--color-muted)]">Simple and reliable for iOS/Android</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Authy</h3>
              <p className="text-[var(--color-muted)]">Multi-device sync and cloud backup</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">1Password</h3>
              <p className="text-[var(--color-muted)]">Integrated with password manager</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Microsoft Authenticator</h3>
              <p className="text-[var(--color-muted)]">Good UX for iOS/Android</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
