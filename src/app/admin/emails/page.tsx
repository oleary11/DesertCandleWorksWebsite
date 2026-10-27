"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Clock, Mail, Package, Pencil, Save, Search, Trash2, Users, X } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal, Segmented, Switch, Tabs } from "../_components/ui";
import { previewInMode, type PreviewMode } from "@/lib/emailPreview";
import { useModal } from "@/hooks/useModal";
import { renderMessageEmail } from "@/lib/emailLayout";
import ConversationsPanel from "./ConversationsPanel";
import SentPanel from "./SentPanel";
import ContactsPanel, { type Contact } from "./ContactsPanel";
import FramePanel, { type ProductOption } from "./FramePanel";
import ScheduledList, { formatSendTime, toLocalInput } from "./ScheduledList";
import { renderFramedEmail, type EmailDesign, type EmailFrame } from "@/lib/emailFrames";

// A person on the To line; contacts from the Contacts tab carry their details along.
type Recipient = {
  email: string;
  name: string;
  phone?: string | null;
  location?: string | null;
  orders?: number;
  sources?: Contact["sources"];
  optedOut?: boolean;
};

const toRecipient = (c: Contact): Recipient => ({
  email: c.email,
  name: c.name || "",
  phone: c.phone,
  location: c.location,
  orders: c.orders,
  sources: c.sources,
  optedOut: c.optedOut,
});

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
  /** Frame + content when the template is a framed (festive) email. */
  design?: EmailDesign | null;
  createdAt: string;
  updatedAt: string;
};

type EmailTemplate = "shipping" | "delivery" | "custom" | string;

type PromoInfo = { code: string; active: boolean; startsAt?: string; expiresAt?: string };

export default function AdminEmailsPage() {
  const { showAlert, showConfirm } = useModal();
  const [view, setView] = useState<"compose" | "contacts" | "conversations" | "sent">("compose");
  const [sentQuery, setSentQuery] = useState("");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [personal, setPersonal] = useState(false);
  // Festive frame (null = standard letter), the frames to choose from, and products to feature
  const [design, setDesign] = useState<EmailDesign | null>(null);
  const [frames, setFrames] = useState<EmailFrame[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
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
  // Send later: a local date-time from the picker ("2026-11-03T09:00"), or "" to send now
  const [sendLater, setSendLater] = useState(false);
  const [sendAt, setSendAt] = useState("");
  const [scheduledRefresh, setScheduledRefresh] = useState(0);
  // Promo codes, to warn when the email's code won't work by the time it arrives
  const [promotions, setPromotions] = useState<PromoInfo[]>([]);

  useEffect(() => {
    fetch("/api/admin/promotions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.promotions && setPromotions(data.promotions))
      .catch(() => {});
  }, []);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("light");
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "phone">("desktop");

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

  // /admin/emails?thread=… (link in the "new reply" notification) opens that conversation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const thread = params.get("thread");
    if (thread) {
      setView("conversations");
      setOpenThreadId(thread);
    } else if (params.get("view") === "sent") {
      // /admin/emails?view=sent&q=ORDER-ID lists every email for that order
      setSentQuery(params.get("q") ?? "");
      setView("sent");
    }
    fetch("/api/admin/email-threads")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUnread(data.unread))
      .catch(() => {});
  }, []);

  const openThread = useCallback((id: string | null) => {
    setOpenThreadId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("thread", id);
    else url.searchParams.delete("thread");
    window.history.replaceState(null, "", url);
  }, []);

  // Contacts power the quick-add buttons and the picker
  useEffect(() => {
    loadRecipients();
  }, []);

  const loadFrames = useCallback(() => {
    fetch("/api/admin/email-frames")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setFrames(data.frames))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFrames();
    fetch("/api/admin/promo-products")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProductOptions(data.products))
      .catch(() => {});
  }, [loadFrames]);

  // Load orders when modal opens
  useEffect(() => {
    if (showOrderModal && allOrders.length === 0) {
      loadOrders();
    }
  }, [showOrderModal]);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await fetch("/api/admin/contacts");
      if (!res.ok) throw new Error("Failed to load recipients");
      const data = (await res.json()) as { contacts: Contact[] };
      setAllRecipients(data.contacts.map(toRecipient));
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
          design,
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
          design,
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
  const filteredRecipients = allRecipients.filter((r) =>
    [r.email, r.name, r.phone, r.location].some((v) => v?.toLowerCase().includes(searchQuery.toLowerCase()))
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

  /** Adds people to the To line (skipping unsubscribed and anyone already there). */
  const addRecipients = (people: Recipient[]) => {
    setSelectedRecipients((prev) => {
      const have = new Set(prev.map((r) => r.email));
      return [...prev, ...people.filter((p) => !p.optedOut && !have.has(p.email))];
    });
  };

  const selectAll = () => addRecipients(filteredRecipients);

  const clearAll = () => {
    setSelectedRecipients([]);
  };

  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderId(order.id);

    // Auto-populate recipient from selected order
    const known = allRecipients.find((r) => r.email === order.email.toLowerCase());
    const recipient: Recipient = known ?? { email: order.email, name: order.customerName };

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
        setDesign(savedTemplate.design ?? null);
      }
    }
  }, [template, orderId, trackingNumber, savedTemplates]);

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      setSendMessage({ type: "error", text: "Please select at least one recipient" });
      return;
    }

    if (!subject || (!message && !design?.headline)) {
      setSendMessage({ type: "error", text: design ? "Please fill in the subject and headline" : "Please fill in subject and message" });
      return;
    }

    if (promoWarning && !(await showConfirm(`${promoWarning} ${sendLater ? "Schedule" : "Send"} it anyway?`, "Promo code problem"))) return;

    const scheduleAt = sendLater && sendAt ? new Date(sendAt) : null;
    if (sendLater && (!scheduleAt || Number.isNaN(scheduleAt.getTime()))) {
      setSendMessage({ type: "error", text: "Pick when to send it" });
      return;
    }

    setSending(true);
    setSendMessage(null);

    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedRecipients.map((r) => ({ email: r.email, name: r.name })),
          subject,
          message,
          personal,
          design,
          template,
          orderId: orderId || undefined,
          trackingNumber: template !== "custom" ? trackingNumber : undefined,
          scheduleAt: scheduleAt?.toISOString() ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");

      setSendMessage({
        type: data.sent > 0 ? "success" : "error",
        text: `${data.scheduledAt ? "Scheduled" : "Sent"} ${data.sent} of ${data.total} ${data.total === 1 ? "email" : "emails"}${
          data.scheduledAt ? ` for ${formatSendTime(data.scheduledAt)}` : ""
        }${data.failed > 0 ? `. ${data.failed} failed.` : "."}${
          data.threadId && data.repliesTracked ? " Their reply will show up in Conversations." : ""
        }`,
      });

      // Clear form on success
      if (data.sent > 0) {
        setSelectedRecipients([]);
        if (data.scheduledAt) {
          setSendLater(false);
          setScheduledRefresh((n) => n + 1);
        }
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
  // The email's promo code, checked against when it will arrive.
  const promoWarning = (() => {
    const code = design?.code?.trim().toUpperCase();
    if (!code || !promotions.length) return null;
    const promo = promotions.find((p) => p.code.toUpperCase() === code);
    if (!promo) return `There's no promo code called ${code}, so it won't work for customers.`;
    if (!promo.active) return `${code} is paused on the Promotions page, so it won't work until you turn it back on.`;
    const arrives = sendLater && sendAt ? new Date(sendAt) : new Date();
    if (promo.expiresAt && new Date(promo.expiresAt) <= arrives)
      return `${code} ends ${formatSendTime(promo.expiresAt)}, ${sendLater ? "before this email goes out" : "so it has already ended"}. The code won't work.`;
    if (promo.startsAt && new Date(promo.startsAt) > arrives)
      return `${code} doesn't start until ${formatSendTime(promo.startsAt)}, after this email arrives.`;
    return null;
  })();

  const canSend = !sending && selectedRecipients.length > 0 && !!subject && (design ? !!design.headline : !!message);
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Same renderer the server sends with; images load from this site for the preview.
  const preview = useMemo(() => {
    const assetBaseUrl = typeof window === "undefined" ? undefined : window.location.origin;
    // Mass emails get an unsubscribe link; show where it will be.
    const unsubscribeUrl = selectedRecipients.length > 1 ? "#" : undefined;
    const frame = design ? frames.find((f) => f.id === design.frameId) : undefined;
    if (design && frame) {
      if (!subject || !design.headline) return null;
      return renderFramedEmail({
        subject,
        message,
        personal,
        frame,
        design,
        products: design.productSlugs.map((slug) => productOptions.find((p) => p.slug === slug)).filter((p): p is ProductOption => !!p),
        assetBaseUrl,
        unsubscribeUrl,
      });
    }
    return subject && message ? renderMessageEmail({ subject, message, personal, assetBaseUrl, unsubscribeUrl }) : null;
  }, [subject, message, personal, selectedRecipients.length, design, frames, productOptions]);

  return (
    <div className="a-ui mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Send emails" description="Email customers, manage your contact list, and read their replies." />

      <Tabs
        label="Email views"
        value={view}
        onChange={setView}
        tabs={[
          { value: "compose", label: "Compose" },
          { value: "contacts", label: "Contacts" },
          { value: "conversations", label: "Conversations", count: unread },
          { value: "sent", label: "Sent" },
        ]}
      />

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

      {view === "contacts" ? (
        <ContactsPanel
          onEmail={(people) => {
            addRecipients(people.map(toRecipient));
            setView("compose");
          }}
        />
      ) : view === "sent" ? (
        <SentPanel key={sentQuery} initialQuery={sentQuery} />
      ) : view === "conversations" ? (
        <ConversationsPanel openThreadId={openThreadId} onOpenThread={openThread} onUnreadChange={setUnread} />
      ) : (
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* To */}
        <section className="a-card flex flex-col overflow-hidden lg:col-span-2 xl:sticky xl:top-20 xl:col-span-1 xl:max-h-[calc(100dvh-110px)]">
          <div className="border-b border-[var(--a-line)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--a-ink)]">
                To <span className="font-normal text-[var(--a-muted)]">({selectedRecipients.length})</span>
              </p>
              {selectedRecipients.length > 0 && (
                <button className="text-xs text-[var(--a-muted)] hover:text-[var(--a-ink)] hover:underline" onClick={clearAll}>
                  Clear
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 xl:flex-col">
              {[
                { label: "Everyone subscribed", people: allRecipients.filter((r) => !r.optedOut) },
                { label: "Customers who ordered", people: allRecipients.filter((r) => !r.optedOut && (r.orders ?? 0) > 0) },
                { label: "Newsletter signups", people: allRecipients.filter((r) => !r.optedOut && r.sources?.includes("newsletter")) },
              ].map((group) => (
                <button
                  key={group.label}
                  className="a-btn a-btn-sm justify-between gap-3"
                  disabled={loadingRecipients || group.people.length === 0}
                  onClick={() => addRecipients(group.people)}
                >
                  <span>+ {group.label}</span>
                  <span className="tabular-nums text-[var(--a-faint)]">{loadingRecipients ? "…" : group.people.length}</span>
                </button>
              ))}
              <button onClick={() => setShowRecipientModal(true)} className="a-btn a-btn-sm border-dashed">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Pick people…
              </button>
            </div>
          </div>
          {selectedRecipients.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--a-muted)]">
              No one yet. Add a group above, pick people, or select them on the Contacts tab.
            </p>
          ) : (
            <ul className="max-h-64 min-h-0 flex-1 divide-y divide-[var(--a-line)] overflow-y-auto xl:max-h-none">
              {selectedRecipients.map((recipient) => (
                <li key={recipient.email} className="flex items-start gap-2 px-4 py-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium text-[var(--a-ink)]">{recipient.name || recipient.email}</p>
                    <p className="truncate text-xs text-[var(--a-muted)]">
                      {[recipient.name ? recipient.email : null, recipient.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleRecipient(recipient)}
                    className="a-icon-btn h-7 w-7 shrink-0"
                    aria-label={`Remove ${recipient.email}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-[var(--a-line)] px-4 py-2.5 text-xs text-[var(--a-muted)]">
            {selectedRecipients.length === 1
              ? "One-to-one: their reply shows up under Conversations."
              : selectedRecipients.length > 1
                ? "Mass email: each person gets their own copy with an unsubscribe link. Replies go to contact@."
                : "One person starts a conversation; several makes a mass email."}
          </p>
        </section>

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

          <FramePanel
            frames={frames}
            products={productOptions}
            design={design}
            onDesignChange={setDesign}
            onFramesChanged={loadFrames}
          />

          <label className="block">
            <span className="a-label">Subject</span>
            <input type="text" className="a-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
          </label>

          <label className="block">
            <span className="a-label">{design ? "Note (optional)" : "Message"}</span>
            <textarea
              className="a-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={16}
              placeholder="Write your message…"
            />
            <p className="a-help">Line breaks are kept in the email; links become clickable.</p>
          </label>

          <div className="flex items-start gap-3 rounded-lg border border-[var(--a-line)] p-3">
            <Switch checked={personal} onChange={() => setPersonal(!personal)} label="Personal email" />
            <div className="text-sm">
              <p className="font-medium text-[var(--a-ink)]">Personal email</p>
              <p className="text-[var(--a-muted)]">Sent from Josh &amp; Cori with your signature at the bottom.</p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--a-line)] p-3">
            <div className="flex items-start gap-3">
              <Switch
                checked={sendLater}
                onChange={() => {
                  // Start the picker at tomorrow, 9 AM
                  if (!sendLater && !sendAt) {
                    const d = new Date(Date.now() + 86_400_000);
                    d.setHours(9, 0, 0, 0);
                    setSendAt(toLocalInput(d));
                  }
                  setSendLater(!sendLater);
                }}
                label="Send later"
              />
              <div className="text-sm">
                <p className="font-medium text-[var(--a-ink)]">Send later</p>
                <p className="text-[var(--a-muted)]">Schedule it up to 30 days ahead. You can cancel it until then.</p>
              </div>
            </div>
            {sendLater && (
              <input
                type="datetime-local"
                className="a-input mt-3"
                value={sendAt}
                min={toLocalInput(new Date(Date.now() + 2 * 60_000))}
                max={toLocalInput(new Date(Date.now() + 30 * 86_400_000))}
                onChange={(e) => setSendAt(e.target.value)}
                aria-label="Send at"
              />
            )}
          </div>

          {promoWarning && (
            <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {promoWarning}
            </p>
          )}

          <button onClick={handleSend} disabled={!canSend || (sendLater && !sendAt)} className="a-btn a-btn-primary h-11 w-full text-[15px]">
            {sendLater ? <Clock className="h-4 w-4" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
            {sending
              ? sendLater
                ? "Scheduling…"
                : "Sending…"
              : sendLater && sendAt
                ? `Schedule for ${formatSendTime(new Date(sendAt).toISOString())}`
                : `Send to ${selectedRecipients.length} ${selectedRecipients.length === 1 ? "recipient" : "recipients"}`}
          </button>

          <ScheduledList refreshKey={scheduledRefresh} />
        </section>

        {/* Preview */}
        <section className="lg:sticky lg:top-20">
          <button className="a-btn mb-3 w-full lg:hidden" onClick={() => setShowPreview(!showPreview)} disabled={!preview}>
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
          <div className={`a-card overflow-hidden ${showPreview ? "" : "hidden lg:block"}`}>
            <div className="border-b border-[var(--a-line)] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="a-section-label text-[var(--a-faint)]">Preview</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-[var(--a-ink)]">{subject || "No subject yet"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Segmented
                    label="Colour mode"
                    value={previewMode}
                    onChange={setPreviewMode}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                      { value: "gmail", label: "Gmail dark" },
                    ]}
                  />
                  <Segmented
                    label="Screen"
                    value={previewWidth}
                    onChange={setPreviewWidth}
                    options={[
                      { value: "desktop", label: "Desktop" },
                      { value: "phone", label: "Phone" },
                    ]}
                  />
                </div>
              </div>
              {previewMode !== "light" && (
                <p className="mt-2 text-xs text-[var(--a-muted)]">
                  {previewMode === "dark"
                    ? "How Apple Mail, iPhone Mail and Outlook for Mac show it in dark mode."
                    : "Roughly how the Gmail app darkens it on its own (it ignores the email's dark design)."}
                </p>
              )}
            </div>
            {preview ? (
              <>
                <div className={previewWidth === "phone" ? "bg-[var(--a-canvas)] px-3 py-3" : ""}>
                  <iframe
                    srcDoc={previewInMode(preview.html, previewMode)}
                    className={`mx-auto block h-[620px] border-0 lg:h-[calc(100dvh-250px)] ${
                      previewWidth === "phone" ? "w-[375px] max-w-full rounded-[22px] border-[6px] border-[#2f2a25]" : "w-full"
                    } ${previewMode === "light" ? "bg-[#f7f2eb]" : "bg-[#121212]"}`}
                    title="Email preview"
                  />
                </div>
                <details className="border-t border-[var(--a-line)]">
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-[var(--a-muted)] hover:text-[var(--a-ink)]">
                    Plain-text version
                  </summary>
                  <pre className="whitespace-pre-wrap break-words bg-[var(--a-canvas)] px-4 py-3 font-mono text-xs text-[var(--a-ink)]">{preview.text}</pre>
                </details>
              </>
            ) : (
              <p className="px-4 py-16 text-center text-sm text-[var(--a-muted)]">{design ? "Write a subject and headline to see the email." : "Write a subject and message to see the email."}</p>
            )}
          </div>
        </section>
      </div>
      )}

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
                      <input
                        type="checkbox"
                        className="a-check"
                        checked={isSelected}
                        disabled={recipient.optedOut && !isSelected}
                        onChange={() => toggleRecipient(recipient)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--a-ink)]">{recipient.name || recipient.email}</span>
                          {recipient.optedOut && <Badge tone="red">Unsubscribed</Badge>}
                        </span>
                        <span className="block truncate text-xs text-[var(--a-muted)]">
                          {[recipient.name ? recipient.email : null, recipient.phone, recipient.location, recipient.orders ? `${recipient.orders} order${recipient.orders === 1 ? "" : "s"}` : null]
                            .filter(Boolean)
                            .join(" · ")}
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
