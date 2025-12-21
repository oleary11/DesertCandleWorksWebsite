"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, X, Mail, Users, User, Package } from "lucide-react";

type Recipient = {
  email: string;
  name: string;
  type: "user" | "guest";
  orderId?: string;
  lastOrderDate?: string;
};

type Order = {
  id: string;
  email: string;
  customerName: string;
  createdAt: string;
  status: string;
  totalCents: number;
};

type EmailTemplate = "shipping" | "delivery" | "custom";

export default function AdminEmailsPage() {
  const [template, setTemplate] = useState<EmailTemplate>("custom");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Recipient selection
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Order-specific fields
  const [orderId, setOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Order selection
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Sending state
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load recipients when modal opens
  useEffect(() => {
    if (showRecipientModal && allRecipients.length === 0) {
      loadRecipients();
    }
  }, [showRecipientModal]);

  // Load orders when modal opens
  useEffect(() => {
    if (showOrderModal && allOrders.length === 0) {
      loadOrders();
    }
  }, [showOrderModal]);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await fetch("/api/admin/email-recipients");
      if (!res.ok) throw new Error("Failed to load recipients");
      const data = await res.json();
      setAllRecipients(data.recipients);
    } catch (err) {
      console.error("Failed to load recipients:", err);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/admin/orders-list");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setAllOrders(data.orders);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Filter recipients based on search
  const filteredRecipients = allRecipients.filter(r =>
    r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter orders based on search
  const filteredOrders = allOrders.filter(o =>
    o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
    o.email.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
    o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase())
  );

  const toggleRecipient = (recipient: Recipient) => {
    if (selectedRecipients.find(r => r.email === recipient.email)) {
      setSelectedRecipients(prev => prev.filter(r => r.email !== recipient.email));
    } else {
      setSelectedRecipients(prev => [...prev, recipient]);
    }
  };

  const selectAll = () => {
    setSelectedRecipients([...filteredRecipients]);
  };

  const clearAll = () => {
    setSelectedRecipients([]);
  };

  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderId(order.id);

    // Auto-populate recipient from selected order
    const recipient: Recipient = {
      email: order.email,
      name: order.customerName,
      type: "guest",
      orderId: order.id,
      lastOrderDate: order.createdAt,
    };

    // Add recipient if not already selected
    if (!selectedRecipients.find(r => r.email === order.email)) {
      setSelectedRecipients(prev => [...prev, recipient]);
    }

    setShowOrderModal(false);
  };

  // Load template when template type changes
  useEffect(() => {
    if (template === "shipping") {
      loadShippingTemplate();
    } else if (template === "delivery") {
      loadDeliveryTemplate();
    } else if (template === "custom") {
      setSubject("");
      setMessage("");
    }
  }, [template, orderId, trackingNumber]);

  const loadShippingTemplate = () => {
    const orderIdText = orderId || "[Order ID]";
    const trackingText = trackingNumber || "[Tracking Number]";

    setSubject(`Your Order Has Shipped! #${orderIdText}`);
    setMessage(`Hi there,

Great news! Your order #${orderIdText} has been shipped and is on its way to you.

Tracking Number: ${trackingText}

Your candles were hand-poured with care in Scottsdale, Arizona. We hope you enjoy them!

If you have any questions about your delivery, please don't hesitate to contact us.

Best regards,
Desert Candle Works Team`);
  };

  const loadDeliveryTemplate = () => {
    const orderIdText = orderId || "[Order ID]";
    const trackingText = trackingNumber || "[Tracking Number]";

    setSubject(`Your Order Has Been Delivered! #${orderIdText}`);
    setMessage(`Hi there,

Your Desert Candle Works order #${orderIdText} has been successfully delivered!

Tracking Number: ${trackingText}

Enjoy Your Candles!
We hope you love your hand-poured candles! Each one is crafted with care right here in Scottsdale, Arizona.

Care Tips:
- Trim wick to 1/4" before each use
- Burn for 2-3 hours at a time for best results
- Keep away from drafts and flammable materials

Love your candles? We'd appreciate it if you could leave us a review!
Leave a Review: https://g.page/r/CQcLSwY5Vml0EBM/review

You can also tag us on social media @desertcandleworks

Best regards,
Desert Candle Works Team`);
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      setSendMessage({ type: "error", text: "Please select at least one recipient" });
      return;
    }

    if (!subject || !message) {
      setSendMessage({ type: "error", text: "Please fill in subject and message" });
      return;
    }

    setSending(true);
    setSendMessage(null);

    try {
      // Convert message to HTML (simple: preserve line breaks)
      const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #fff; white-space: pre-wrap; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: white;">Desert Candle Works</h1>
  </div>
  <div class="content">${message}</div>
  <div class="footer">
    <p style="margin: 0;">© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
    <p style="margin: 5px 0 0 0;">Scottsdale, AZ | www.desertcandleworks.com</p>
    <p style="margin: 10px 0 0 0;">
      <a href="mailto:contact@desertcandleworks.com">contact@desertcandleworks.com</a>
    </p>
  </div>
</body>
</html>`;

      const textBody = `Desert Candle Works

${message}

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
contact@desertcandleworks.com`;

      // Send to each recipient
      let successCount = 0;
      let failCount = 0;

      for (const recipient of selectedRecipients) {
        try {
          const res = await fetch("/api/admin/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipients: "single",
              singleEmail: recipient.email,
              template,
              subject,
              htmlBody,
              textBody,
              trackingNumber: template !== "custom" ? trackingNumber : undefined,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }

      setSendMessage({
        type: successCount > 0 ? "success" : "error",
        text: `Sent ${successCount} of ${selectedRecipients.length} emails${
          failCount > 0 ? `. ${failCount} failed.` : ""
        }`,
      });

      // Clear form on success
      if (successCount > 0) {
        setSelectedRecipients([]);
        if (template === "custom") {
          setSubject("");
          setMessage("");
        }
      }
    } catch (err) {
      setSendMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send email",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link href="/admin" style={{ color: "#1e40af", textDecoration: "none" }}>
          ← Back to Admin
        </Link>
      </div>

      <h1 style={{ marginBottom: "10px" }}>Send Emails</h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        Send emails to customers using templates or custom messages
      </p>

      {sendMessage && (
        <div
          style={{
            padding: "15px",
            marginBottom: "20px",
            borderRadius: "8px",
            background: sendMessage.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${sendMessage.type === "success" ? "#86efac" : "#fca5a5"}`,
            color: sendMessage.type === "success" ? "#15803d" : "#dc2626",
          }}
        >
          {sendMessage.text}
        </div>
      )}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "24px",
        }}
      >
        {/* Template Selection */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
            Email Template
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

        {/* Order-specific fields */}
        {(template === "shipping" || template === "delivery") && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                Order
              </label>

              {selectedOrder ? (
                <div
                  style={{
                    padding: "12px",
                    background: "#eff6ff",
                    border: "2px solid #1e40af",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px" }}>
                      Order #{selectedOrder.id}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666", marginTop: "2px" }}>
                      {selectedOrder.customerName} ({selectedOrder.email})
                    </div>
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                      {new Date(selectedOrder.createdAt).toLocaleDateString()} · ${(selectedOrder.totalCents / 100).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      setOrderId("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    <X style={{ width: "20px", height: "20px", color: "#6b7280" }} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowOrderModal(true)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#f9fafb",
                    border: "2px dashed #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#4b5563",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Package style={{ width: "18px", height: "18px" }} />
                  Select Order
                </button>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
                Tracking Number
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="HAND-DELIVERED or tracking number"
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                For internal delivery, use &ldquo;HAND-DELIVERED&rdquo; or any custom text
              </p>
            </div>
          </>
        )}

        {/* Recipients */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
            Recipients ({selectedRecipients.length} selected)
          </label>

          {selectedRecipients.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "12px",
                padding: "12px",
                background: "#f9fafb",
                borderRadius: "6px",
              }}
            >
              {selectedRecipients.map(recipient => (
                <div
                  key={recipient.email}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                >
                  <span>{recipient.name} ({recipient.email})</span>
                  <button
                    onClick={() => toggleRecipient(recipient)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowRecipientModal(true)}
            style={{
              width: "100%",
              padding: "12px",
              background: "#f9fafb",
              border: "2px dashed #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              color: "#4b5563",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Users style={{ width: "18px", height: "18px" }} />
            {selectedRecipients.length === 0 ? "Select Recipients" : "Add More Recipients"}
          </button>
        </div>

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

        {/* Message */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={12}
            placeholder="Write your message here..."
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Line breaks will be preserved in the email
          </p>
        </div>

        {/* Email Preview */}
        {subject && message && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label style={{ fontWeight: "600" }}>Email Preview</label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  padding: "6px 12px",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
            </div>

            {showPreview && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                {/* HTML Preview */}
                <div style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb", padding: "8px 12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>HTML Version</span>
                </div>
                <iframe
                  srcDoc={`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #fff; white-space: pre-wrap; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: white;">Desert Candle Works</h1>
  </div>
  <div class="content">${message}</div>
  <div class="footer">
    <p style="margin: 0;">© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
    <p style="margin: 5px 0 0 0;">Scottsdale, AZ | www.desertcandleworks.com</p>
    <p style="margin: 10px 0 0 0;">
      <a href="mailto:contact@desertcandleworks.com">contact@desertcandleworks.com</a>
    </p>
  </div>
</body>
</html>`}
                  style={{
                    width: "100%",
                    height: "400px",
                    border: "none",
                    display: "block",
                  }}
                  title="Email Preview"
                />

                {/* Plain Text Preview */}
                <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb", padding: "8px 12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Plain Text Version</span>
                </div>
                <pre
                  style={{
                    padding: "16px",
                    margin: 0,
                    fontSize: "13px",
                    color: "#374151",
                    background: "#fff",
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    fontFamily: "monospace",
                  }}
                >{`Desert Candle Works

${message}

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
contact@desertcandleworks.com`}</pre>
              </div>
            )}
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || selectedRecipients.length === 0 || !subject || !message}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: sending || selectedRecipients.length === 0 || !subject || !message ? "#9ca3af" : "#1e40af",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: sending || selectedRecipients.length === 0 || !subject || !message ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Mail style={{ width: "20px", height: "20px" }} />
          {sending ? "Sending..." : `Send to ${selectedRecipients.length} Recipient${selectedRecipients.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Recipient Selection Modal */}
      {showRecipientModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowRecipientModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "600px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                Select Recipients
              </h2>
              <button
                onClick={() => setShowRecipientModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X style={{ width: "24px", height: "24px" }} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ position: "relative" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "18px",
                    height: "18px",
                    color: "#9ca3af",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  style={{
                    width: "100%",
                    padding: "10px 10px 10px 40px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                <button
                  onClick={selectAll}
                  style={{
                    padding: "6px 12px",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Select All ({filteredRecipients.length})
                </button>
                <button
                  onClick={clearAll}
                  style={{
                    padding: "6px 12px",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Recipients List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {loadingRecipients ? (
                <p style={{ textAlign: "center", color: "#666" }}>Loading recipients...</p>
              ) : filteredRecipients.length === 0 ? (
                <p style={{ textAlign: "center", color: "#666" }}>No recipients found</p>
              ) : (
                filteredRecipients.map(recipient => {
                  const isSelected = selectedRecipients.find(r => r.email === recipient.email);
                  return (
                    <div
                      key={recipient.email}
                      onClick={() => toggleRecipient(recipient)}
                      style={{
                        padding: "12px",
                        marginBottom: "8px",
                        border: `2px solid ${isSelected ? "#1e40af" : "#e5e7eb"}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: isSelected ? "#eff6ff" : "#fff",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            border: `2px solid ${isSelected ? "#1e40af" : "#d1d5db"}`,
                            borderRadius: "4px",
                            background: isSelected ? "#1e40af" : "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <span style={{ color: "white", fontSize: "14px" }}>✓</span>
                          )}
                        </div>

                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: recipient.type === "user" ? "#dbeafe" : "#f3f4f6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <User style={{ width: "18px", height: "18px", color: recipient.type === "user" ? "#1e40af" : "#6b7280" }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: "600", fontSize: "14px" }}>
                            {recipient.name}
                          </div>
                          <div style={{ fontSize: "13px", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {recipient.email}
                          </div>
                          {recipient.lastOrderDate && (
                            <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                              Last order: {new Date(recipient.lastOrderDate).toLocaleDateString()}
                              {recipient.orderId && ` (${recipient.orderId})`}
                            </div>
                          )}
                        </div>

                        {recipient.type === "user" && (
                          <span
                            style={{
                              padding: "2px 8px",
                              background: "#dbeafe",
                              color: "#1e40af",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "600",
                            }}
                          >
                            ACCOUNT
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "14px", color: "#666" }}>
                {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setShowRecipientModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "#1e40af",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Selection Modal */}
      {showOrderModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowOrderModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "700px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                Select Order
              </h2>
              <button
                onClick={() => setShowOrderModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X style={{ width: "24px", height: "24px" }} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ position: "relative" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "18px",
                    height: "18px",
                    color: "#9ca3af",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search by order ID, customer name, or email..."
                  style={{
                    width: "100%",
                    padding: "10px 10px 10px 40px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            {/* Orders List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {loadingOrders ? (
                <p style={{ textAlign: "center", color: "#666" }}>Loading orders...</p>
              ) : filteredOrders.length === 0 ? (
                <p style={{ textAlign: "center", color: "#666" }}>No orders found</p>
              ) : (
                filteredOrders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => selectOrder(order)}
                    style={{
                      padding: "14px",
                      marginBottom: "8px",
                      border: `2px solid ${selectedOrder?.id === order.id ? "#1e40af" : "#e5e7eb"}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: selectedOrder?.id === order.id ? "#eff6ff" : "#fff",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          background: "#dbeafe",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Package style={{ width: "20px", height: "20px", color: "#1e40af" }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: "600", fontSize: "15px", marginBottom: "4px" }}>
                          Order #{order.id}
                        </div>
                        <div style={{ fontSize: "14px", color: "#374151", marginBottom: "4px" }}>
                          {order.customerName}
                        </div>
                        <div style={{ fontSize: "13px", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }}>
                          {order.email}
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#9ca3af" }}>
                          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>${(order.totalCents / 100).toFixed(2)}</span>
                          <span>·</span>
                          <span style={{
                            padding: "2px 6px",
                            background: order.status === "completed" ? "#d1fae5" : "#fee2e2",
                            color: order.status === "completed" ? "#065f46" : "#991b1b",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "600",
                            textTransform: "uppercase",
                          }}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => setShowOrderModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
