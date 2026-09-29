"use client";

import { useState, useEffect } from "react";
import { Mail, Package, Pencil, Save, Search, Trash2, Users, X } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal } from "../_components/ui";
import { useModal } from "@/hooks/useModal";

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

type SavedTemplate = {
  id: string;
  name: string;
  subject: string;
  message: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type EmailTemplate = "shipping" | "delivery" | "custom" | string;

export default function AdminEmailsPage() {
  const { showAlert, showConfirm } = useModal();
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

  // Template management
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SavedTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

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

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/admin/email-templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setSavedTemplates(data.templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !message.trim()) {
      await showAlert("Please provide a template name, subject, and message", "Validation Error");
      return;
    }

    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          subject,
          message,
          isDefault: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to save template");

      await loadTemplates();
      setTemplateName("");
      setShowTemplateModal(false);
      setSendMessage({ type: "success", text: "Template saved successfully" });
    } catch (err) {
      console.error("Failed to save template:", err);
      setSendMessage({ type: "error", text: "Failed to save template" });
    }
  };

  const updateTemplate = async (templateId: string) => {
    if (!subject.trim() || !message.trim()) {
      await showAlert("Please provide subject and message", "Validation Error");
      return;
    }

    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: templateId,
          name: editingTemplate?.name,
          subject,
          message,
          isDefault: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to update template");

      await loadTemplates();
      setEditingTemplate(null);
      setSendMessage({ type: "success", text: "Template updated successfully" });
    } catch (err) {
      console.error("Failed to update template:", err);
      setSendMessage({ type: "error", text: "Failed to update template" });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    const confirmed = await showConfirm("Are you sure you want to delete this template?", "Delete Template");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/email-templates?id=${templateId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete template");

      await loadTemplates();
      if (template === templateId) {
        setTemplate("custom");
      }
      setSendMessage({ type: "success", text: "Template deleted successfully" });
    } catch (err) {
      console.error("Failed to delete template:", err);
      setSendMessage({ type: "error", text: "Failed to delete template" });
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
    if (template === "custom") {
      setSubject("");
      setMessage("");
    } else {
      // Load saved template
      const savedTemplate = savedTemplates.find(t => t.id === template);
      if (savedTemplate) {
        const subjectText = savedTemplate.subject;
        const messageText = savedTemplate.message;

        // Replace placeholders with actual values
        const orderIdText = orderId || "[Order ID]";
        const trackingText = trackingNumber || "[Tracking Number]";

        const finalMessage = messageText
          .replace(/\[Order ID\]/g, orderIdText)
          .replace(/\[Tracking Number\]/g, trackingText);

        setSubject(subjectText);
        setMessage(finalMessage);
      }
    }
  }, [template, orderId, trackingNumber, savedTemplates]);

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

  const activeSaved = savedTemplates.find((t) => t.id === template);
  const needsOrder = template !== "custom" && !!activeSaved?.message.includes("[Order ID]");
  const canSend = !sending && selectedRecipients.length > 0 && !!subject && !!message;
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Send emails" description="Email customers with a saved template or a one-off message." />

      {sendMessage && (
        <div
          role={sendMessage.type === "error" ? "alert" : "status"}
          className={`mb-6 flex items-start justify-between gap-3 rounded-lg border p-4 text-sm ${
            sendMessage.type === "success" ? "border-green-200 bg-[#e8f5ec] text-[#1f4d2e]" : "border-red-200 bg-[#fdecea] text-[#7a1a12]"
          }`}
        >
          {sendMessage.text}
          <button className="shrink-0 opacity-70 hover:opacity-100" onClick={() => setSendMessage(null)} aria-label="Dismiss">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Compose */}
        <section className="a-card space-y-5 p-5 sm:p-6">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="email-template" className="a-label mb-0">
                Template
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setShowTemplateModal(true);
                    setTemplateName("");
                  }}
                  className="a-btn a-btn-sm"
                  disabled={!subject.trim() || !message.trim()}
                  title={!subject.trim() || !message.trim() ? "Write a subject and message first" : undefined}
                >
                  <Save className="h-3.5 w-3.5" aria-hidden />
                  Save as template
                </button>
                {template !== "custom" && (
                  <>
                    <button
                      onClick={() => {
                        if (activeSaved) setEditingTemplate(activeSaved);
                      }}
                      className="a-icon-btn h-8 w-8"
                      aria-label="Edit template"
                      title="Edit template"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    {!activeSaved?.isDefault && (
                      <button
                        onClick={() => deleteTemplate(template)}
                        className="a-icon-btn a-icon-btn-danger h-8 w-8"
                        aria-label="Delete template"
                        title="Delete template"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <select
              id="email-template"
              className="a-select text-[var(--a-ink)]"
              value={template}
              onChange={(e) => setTemplate(e.target.value as EmailTemplate)}
              disabled={loadingTemplates}
            >
              <option value="custom">Custom message</option>
              {savedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {needsOrder && (
            <div className="a-panel space-y-4">
              <div>
                <p className="a-label">Order</p>
                {selectedOrder ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--a-line)] bg-white p-3">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-mono font-medium text-[var(--a-ink)]">{selectedOrder.id}</p>
                      <p className="truncate text-[var(--a-muted)]">
                        {selectedOrder.customerName} · {selectedOrder.email}
                      </p>
                      <p className="text-xs text-[var(--a-faint)]">
                        {new Date(selectedOrder.createdAt).toLocaleDateString()} · {money(selectedOrder.totalCents)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedOrder(null);
                        setOrderId("");
                      }}
                      className="a-icon-btn h-8 w-8 shrink-0"
                      aria-label="Clear order"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowOrderModal(true)} className="a-btn w-full border-dashed">
                    <Package className="h-4 w-4" aria-hidden />
                    Choose an order
                  </button>
                )}
              </div>

              <label className="block">
                <span className="a-label">Tracking number</span>
                <input
                  type="text"
                  className="a-input font-mono"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="HAND-DELIVERED or a tracking number"
                />
                <p className="a-help">For hand delivery, type HAND-DELIVERED or any note.</p>
              </label>
            </div>
          )}

          <div>
            <p className="a-label">
              To <span className="font-normal text-[var(--a-muted)]">({selectedRecipients.length})</span>
            </p>
            {selectedRecipients.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {selectedRecipients.map((recipient) => (
                  <li
                    key={recipient.email}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--a-line)] bg-[var(--a-canvas)] py-0.5 pl-2.5 pr-1 text-sm"
                    title={recipient.email}
                  >
                    <span className="truncate">{recipient.name || recipient.email}</span>
                    <button
                      onClick={() => toggleRecipient(recipient)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--a-muted)] hover:bg-[var(--a-tint)] hover:text-[var(--a-ink)]"
                      aria-label={`Remove ${recipient.email}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowRecipientModal(true)} className="a-btn w-full border-dashed">
              <Users className="h-4 w-4" aria-hidden />
              {selectedRecipients.length === 0 ? "Choose recipients" : "Add more recipients"}
            </button>
          </div>

          <label className="block">
            <span className="a-label">Subject</span>
            <input type="text" className="a-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
          </label>

          <label className="block">
            <span className="a-label">Message</span>
            <textarea
              className="a-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              placeholder="Write your message…"
            />
            <p className="a-help">Line breaks are kept in the email.</p>
          </label>

          <button onClick={handleSend} disabled={!canSend} className="a-btn a-btn-primary h-11 w-full text-[15px]">
            <Mail className="h-4 w-4" aria-hidden />
            {sending
              ? "Sending…"
              : `Send to ${selectedRecipients.length} ${selectedRecipients.length === 1 ? "recipient" : "recipients"}`}
          </button>
        </section>

        {/* Preview */}
        <section className="lg:sticky lg:top-20">
          <button className="a-btn mb-3 w-full lg:hidden" onClick={() => setShowPreview(!showPreview)} disabled={!subject || !message}>
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
          <div className={`a-card overflow-hidden ${showPreview ? "" : "hidden lg:block"}`}>
            <div className="border-b border-[var(--a-line)] px-4 py-3">
              <p className="a-section-label text-[var(--a-faint)]">Preview</p>
              <p className="mt-0.5 truncate text-sm font-medium text-[var(--a-ink)]">{subject || "No subject yet"}</p>
            </div>
            {subject && message ? (
              <>
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
                  className="block h-[480px] w-full border-0 bg-white"
                  title="Email preview"
                />
                <details className="border-t border-[var(--a-line)]">
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-[var(--a-muted)] hover:text-[var(--a-ink)]">
                    Plain-text version
                  </summary>
                  <pre className="whitespace-pre-wrap break-words bg-[var(--a-canvas)] px-4 py-3 font-mono text-xs text-[var(--a-ink)]">{`Desert Candle Works

${message}

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
contact@desertcandleworks.com`}</pre>
                </details>
              </>
            ) : (
              <p className="px-4 py-16 text-center text-sm text-[var(--a-muted)]">Write a subject and message to see the email.</p>
            )}
          </div>
        </section>
      </div>

      {/* Recipient picker */}
      {showRecipientModal && (
        <Modal
          title="Choose recipients"
          onClose={() => setShowRecipientModal(false)}
          footer={
            <>
              <span className="mr-auto text-sm text-[var(--a-muted)]">{selectedRecipients.length} selected</span>
              <button onClick={() => setShowRecipientModal(false)} className="a-btn a-btn-primary">
                Done
              </button>
            </>
          }
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <label className="relative block flex-1">
              <span className="sr-only">Search recipients</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
              <input
                type="text"
                className="a-input pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or email…"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="a-btn a-btn-sm h-10">
                Select all ({filteredRecipients.length})
              </button>
              <button onClick={clearAll} className="a-btn a-btn-sm h-10">
                Clear
              </button>
            </div>
          </div>

          {loadingRecipients ? (
            <p className="py-10 text-center text-sm text-[var(--a-muted)]">Loading recipients…</p>
          ) : filteredRecipients.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--a-muted)]">No recipients found.</p>
          ) : (
            <ul className="divide-y divide-[var(--a-line)] rounded-lg border border-[var(--a-line)]">
              {filteredRecipients.map((recipient) => {
                const isSelected = !!selectedRecipients.find((r) => r.email === recipient.email);
                return (
                  <li key={recipient.email}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${isSelected ? "bg-[var(--a-tint)]" : "hover:bg-[var(--a-canvas)]"}`}>
                      <input type="checkbox" className="a-check" checked={isSelected} onChange={() => toggleRecipient(recipient)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--a-ink)]">{recipient.name}</span>
                          {recipient.type === "user" && <Badge tone="blue">Account</Badge>}
                        </span>
                        <span className="block truncate text-xs text-[var(--a-muted)]">
                          {recipient.email}
                          {recipient.lastOrderDate && ` · last order ${new Date(recipient.lastOrderDate).toLocaleDateString()}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      {/* Order picker */}
      {showOrderModal && (
        <Modal
          size="lg"
          title="Choose an order"
          onClose={() => setShowOrderModal(false)}
          footer={
            <button onClick={() => setShowOrderModal(false)} className="a-btn">
              Cancel
            </button>
          }
        >
          <label className="relative mb-3 block">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
            <input
              type="text"
              className="a-input pl-9"
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              placeholder="Search order ID, name or email…"
              autoFocus
            />
          </label>

          {loadingOrders ? (
            <p className="py-10 text-center text-sm text-[var(--a-muted)]">Loading orders…</p>
          ) : filteredOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--a-muted)]">No orders found.</p>
          ) : (
            <ul className="divide-y divide-[var(--a-line)] rounded-lg border border-[var(--a-line)]">
              {filteredOrders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => selectOrder(order)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                      selectedOrder?.id === order.id ? "bg-[var(--a-tint)]" : "hover:bg-[var(--a-canvas)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--a-ink)]">{order.customerName || order.email}</span>
                      <span className="block truncate text-xs text-[var(--a-muted)]">
                        {order.email} · {new Date(order.createdAt).toLocaleDateString()} · <span className="font-mono">{order.id}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums">{money(order.totalCents)}</span>
                      <Badge tone={order.status === "completed" ? "green" : "red"}>{order.status}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Save template */}
      {showTemplateModal && (
        <Modal
          size="sm"
          title="Save as template"
          description="Saves the current subject and message for reuse."
          onClose={() => setShowTemplateModal(false)}
          footer={
            <>
              <button onClick={() => setShowTemplateModal(false)} className="a-btn">
                Cancel
              </button>
              <button onClick={saveTemplate} className="a-btn a-btn-primary">
                Save template
              </button>
            </>
          }
        >
          <label className="block">
            <span className="a-label">Template name</span>
            <input
              type="text"
              className="a-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Welcome email, Promo announcement"
              autoFocus
            />
          </label>
          <dl className="a-panel mt-4 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-[var(--a-muted)]">Subject</dt>
              <dd className="min-w-0 truncate font-medium">{subject}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-[var(--a-muted)]">Message</dt>
              <dd>{message.length} characters</dd>
            </div>
          </dl>
        </Modal>
      )}

      {/* Edit template */}
      {editingTemplate && (
        <Modal
          title={`Edit “${editingTemplate.name}”`}
          description="Use [Order ID] and [Tracking Number] where those should be filled in."
          onClose={() => setEditingTemplate(null)}
          footer={
            <>
              <button onClick={() => setEditingTemplate(null)} className="a-btn">
                Cancel
              </button>
              <button onClick={() => updateTemplate(editingTemplate.id)} className="a-btn a-btn-primary">
                Save template
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="a-label">Subject</span>
              <input type="text" className="a-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="block">
              <span className="a-label">Message</span>
              <textarea className="a-textarea font-mono text-[13px]" value={message} onChange={(e) => setMessage(e.target.value)} rows={12} />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
