"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import CandleSpinner from "@/components/CandleSpinner";

const DEFAULT_DESCRIPTION_TEMPLATE = "Hand-poured candle in an upcycled {{BOTTLE_NAME}} bottle.\n\ncoco apricot creme™ candle wax\n\nApprox. - {{WAX_OZ}} oz wax";

interface CalculatorSettings {
  waxCostPerOz: number;
  waterToWaxRatio: number;
  defaultFragranceLoad: number;
  defaultProductDescription?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CalculatorSettings | null>(null);
  const [descriptionTemplate, setDescriptionTemplate] = useState(DEFAULT_DESCRIPTION_TEMPLATE);
  const [originalTemplate, setOriginalTemplate] = useState(DEFAULT_DESCRIPTION_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/calculator-settings");
        if (res.ok) {
          const data = await res.json();
          // API returns { settings: {...} }
          const loadedSettings = data.settings || data;
          setSettings(loadedSettings);
          const template = loadedSettings.defaultProductDescription || DEFAULT_DESCRIPTION_TEMPLATE;
          setDescriptionTemplate(template);
          setOriginalTemplate(template);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        setMessage({ type: "error", text: "Failed to load settings" });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function saveTemplate() {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      // API uses POST, and we need to include all required fields
      const res = await fetch("/api/admin/calculator-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waxCostPerOz: settings.waxCostPerOz,
          waterToWaxRatio: settings.waterToWaxRatio,
          defaultFragranceLoad: settings.defaultFragranceLoad,
          defaultProductDescription: descriptionTemplate,
        }),
      });

      if (res.ok) {
        setOriginalTemplate(descriptionTemplate);
        setSettings({ ...settings, defaultProductDescription: descriptionTemplate });
        setMessage({ type: "success", text: "Template saved successfully!" });
      } else {
        const errorData = await res.json();
        setMessage({ type: "error", text: errorData.error || "Failed to save template" });
      }
    } catch (err) {
      console.error("Failed to save template:", err);
      setMessage({ type: "error", text: "Failed to save template" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  }

  const hasChanges = descriptionTemplate !== originalTemplate;

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-ink)]">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="a-ui mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">Settings</h1>
          <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">
            Configure product templates and default values
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Default Product Description Template */}
        <div className="a-card p-5 mb-6">
          <h2 className="text-xl font-semibold mb-2">Default Product Description</h2>
          <p className="text-sm text-[var(--a-muted)] mb-4">
            This template is used when auto-generating product descriptions in the calculator.
            Use the following placeholders:
          </p>

          <div className="bg-[var(--a-canvas)] rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-2">Available Placeholders</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <code className="bg-white px-2 py-0.5 rounded border text-xs font-mono">{"{{BOTTLE_NAME}}"}</code>
                <span className="text-[var(--a-muted)]">Product name with &quot;Candle&quot; removed (e.g., &quot;Tito&apos;s&quot;)</span>
              </li>
              <li className="flex items-start gap-2">
                <code className="bg-white px-2 py-0.5 rounded border text-xs font-mono">{"{{WAX_OZ}}"}</code>
                <span className="text-[var(--a-muted)]">Calculated wax ounces based on container capacity</span>
              </li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="a-label">Description Template</label>
            <textarea
              className="w-full p-3 border border-[var(--a-line)] rounded-lg font-mono text-sm resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              placeholder="Enter description template…"
            />
            <p className="text-xs text-[var(--a-muted)] mt-2">
              Line breaks in the template will be preserved in the generated description.
            </p>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <label className="a-label">Preview</label>
            <div className="p-4 bg-[var(--a-canvas)] rounded-lg border border-[var(--a-line)] text-sm whitespace-pre-wrap">
              {descriptionTemplate
                .replace(/\{\{BOTTLE_NAME\}\}/g, "Tito's")
                .replace(/\{\{WAX_OZ\}\}/g, "12")}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--a-line)]">
            <button
              className="text-sm text-[var(--a-muted)] hover:text-[var(--a-ink)] transition-colors"
              onClick={() => setDescriptionTemplate(DEFAULT_DESCRIPTION_TEMPLATE)}
              disabled={descriptionTemplate === DEFAULT_DESCRIPTION_TEMPLATE}
            >
              Reset to default
            </button>
            <button
              className="a-btn a-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={saveTemplate}
              disabled={!hasChanges || saving}
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
