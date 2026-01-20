"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

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
      <div className="min-h-screen p-6 bg-neutral-50">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-[var(--color-muted)] mt-1">
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
        <div className="card p-6 bg-white mb-6">
          <h2 className="text-xl font-semibold mb-2">Default Product Description</h2>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            This template is used when auto-generating product descriptions in the calculator.
            Use the following placeholders:
          </p>

          <div className="bg-neutral-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-2">Available Placeholders</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <code className="bg-white px-2 py-0.5 rounded border text-xs font-mono">{"{{BOTTLE_NAME}}"}</code>
                <span className="text-[var(--color-muted)]">Product name with &quot;Candle&quot; removed (e.g., &quot;Tito&apos;s&quot;)</span>
              </li>
              <li className="flex items-start gap-2">
                <code className="bg-white px-2 py-0.5 rounded border text-xs font-mono">{"{{WAX_OZ}}"}</code>
                <span className="text-[var(--color-muted)]">Calculated wax ounces based on container capacity</span>
              </li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Description Template</label>
            <textarea
              className="w-full p-3 border border-[var(--color-line)] rounded-lg font-mono text-sm resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              placeholder="Enter description template..."
            />
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Line breaks in the template will be preserved in the generated description.
            </p>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Preview</label>
            <div className="p-4 bg-neutral-50 rounded-lg border border-[var(--color-line)] text-sm whitespace-pre-wrap">
              {descriptionTemplate
                .replace(/\{\{BOTTLE_NAME\}\}/g, "Tito's")
                .replace(/\{\{WAX_OZ\}\}/g, "12")}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-line)]">
            <button
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
              onClick={() => setDescriptionTemplate(DEFAULT_DESCRIPTION_TEMPLATE)}
              disabled={descriptionTemplate === DEFAULT_DESCRIPTION_TEMPLATE}
            >
              Reset to default
            </button>
            <button
              className="btn bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={saveTemplate}
              disabled={!hasChanges || saving}
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
