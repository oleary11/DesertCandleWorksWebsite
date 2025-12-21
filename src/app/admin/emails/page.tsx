"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type EmailTemplate = "shipping" | "delivery" | "custom";
type RecipientType = "single" | "order_customers" | "all_customers";

export default function AdminEmailsPage() {
  const [template, setTemplate] = useState<EmailTemplate>("custom");
  const [recipients, setRecipients] = useState<RecipientType>("single");
  const [singleEmail, setSingleEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load template when template type, orderId, or trackingNumber changes
  useEffect(() => {
    if (template === "shipping" || template === "delivery") {
      if (!orderId || !trackingNumber) return;
    }
    loadTemplate();
  }, [template, orderId, trackingNumber]);

  const loadTemplate = async () => {
    try {
      const params = new URLSearchParams({ template });
      if (orderId) params.append("orderId", orderId);
      if (trackingNumber) params.append("trackingNumber", trackingNumber);

      const res = await fetch(`/api/admin/send-email?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load template");

      const data = await res.json();
      setSubject(data.subject);
      setHtmlBody(data.html);
      setTextBody(data.text);
    } catch (err) {
      console.error("Failed to load template:", err);
      setMessage({ type: "error", text: "Failed to load template" });
    }
  };

  const handleSend = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          singleEmail: recipients === "single" ? singleEmail : undefined,
          orderId: recipients === "order_customers" ? orderId : undefined,
          template,
          subject,
          htmlBody,
          textBody,
          trackingNumber: template !== "custom" ? trackingNumber : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      setMessage({
        type: "success",
        text: `Successfully sent ${data.sent} of ${data.total} emails${
          data.failed > 0 ? `. ${data.failed} failed.` : ""
        }`,
      });

      // Reset form on success
      if (recipients === "single") {
        setSingleEmail("");
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send email",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link href="/admin" style={{ color: "#1e40af", textDecoration: "none" }}>
          ← Back to Admin
        </Link>
      </div>

      <h1 style={{ marginBottom: "10px" }}>Send Emails</h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        Send emails to customers using templates or custom messages
      </p>

      {message && (
        <div
          style={{
            padding: "15px",
            marginBottom: "20px",
            borderRadius: "8px",
            background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${message.type === "success" ? "#86efac" : "#fca5a5"}`,
            color: message.type === "success" ? "#15803d" : "#dc2626",
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
        {/* Left Column - Settings */}
        <div>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>Email Settings</h2>

            {/* Template Selection */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as EmailTemplate)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              >
                <option value="custom">Custom Message</option>
                <option value="shipping">Shipping Notification</option>
                <option value="delivery">Delivery Notification</option>
              </select>
            </div>

            {/* Recipient Selection */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                Send To
              </label>
              <select
                value={recipients}
                onChange={(e) => setRecipients(e.target.value as RecipientType)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              >
                <option value="single">Single Email Address</option>
                <option value="order_customers">Customer from Order ID</option>
                <option value="all_customers">All Customers (Mass Email)</option>
              </select>
            </div>

            {/* Single Email Input */}
            {recipients === "single" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  placeholder="customer@example.com"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            )}

            {/* Order ID Input */}
            {(recipients === "order_customers" || template === "shipping" || template === "delivery") && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                  Order ID
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="ST00001"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            )}

            {/* Tracking Number Input */}
            {(template === "shipping" || template === "delivery") && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="9400100000000000000000"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
                <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                  {template === "shipping"
                    ? "For internal delivery, you can use 'HAND-DELIVERED' or any custom tracking text"
                    : "For internal delivery confirmations"}
                </p>
              </div>
            )}

            {/* Subject */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your subject line"
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* HTML Body */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                HTML Body
              </label>
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={10}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                }}
              />
            </div>

            {/* Text Body */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                Plain Text Body
              </label>
              <textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={8}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  padding: "12px 24px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
              <button
                onClick={handleSend}
                disabled={loading || !subject || !htmlBody || !textBody}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  background: loading ? "#9ca3af" : "#1e40af",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                {loading ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div>
          {showPreview && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>Email Preview</h2>

              <div
                style={{
                  marginBottom: "15px",
                  paddingBottom: "15px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Subject:</p>
                <p style={{ margin: 0, fontWeight: "600" }}>{subject || "(No subject)"}</p>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#666" }}>
                  HTML Preview:
                </p>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    overflow: "hidden",
                    maxHeight: "500px",
                    overflowY: "auto",
                  }}
                >
                  <iframe
                    srcDoc={htmlBody}
                    style={{
                      width: "100%",
                      minHeight: "400px",
                      border: "none",
                    }}
                    title="Email Preview"
                  />
                </div>
              </div>

              <div>
                <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#666" }}>
                  Plain Text Preview:
                </p>
                <pre
                  style={{
                    background: "#f9fafb",
                    padding: "15px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {textBody || "(No text body)"}
                </pre>
              </div>
            </div>
          )}

          {!showPreview && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "40px",
                textAlign: "center",
                color: "#9ca3af",
              }}
            >
              <p style={{ fontSize: "48px", margin: "0 0 10px 0" }}>📧</p>
              <p style={{ margin: 0 }}>Click "Show Preview" to see how your email will look</p>
            </div>
          )}
        </div>
      </div>

      {/* Warning for mass emails */}
      {recipients === "all_customers" && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#fef3c7",
            border: "1px solid #fbbf24",
            borderRadius: "8px",
            color: "#92400e",
          }}
        >
          <strong>⚠️ Warning:</strong> You are about to send this email to ALL customers who have
          placed orders. Please review the content carefully before sending.
        </div>
      )}
    </div>
  );
}
