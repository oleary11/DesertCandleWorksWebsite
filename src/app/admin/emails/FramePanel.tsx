"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, ImagePlus, Plus, Trash2 } from "lucide-react";
import { Modal, Switch } from "../_components/ui";
import {
  DEFAULT_DESIGN,
  type EmailDesign,
  type EmailFrame,
  type FramedProduct,
} from "@/lib/emailFrames";

export type ProductOption = FramedProduct & { slug: string };

/** Picks the look (standard letter or a frame) and edits what goes inside the frame. */
export default function FramePanel({
  frames,
  products,
  design,
  onDesignChange,
  onFramesChanged,
}: {
  frames: EmailFrame[];
  products: ProductOption[];
  design: EmailDesign | null;
  onDesignChange: (design: EmailDesign | null) => void;
  onFramesChanged: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const set = (patch: Partial<EmailDesign>) =>
    design && onDesignChange({ ...design, ...patch });

  const pickFrame = (frameId: string | null) => {
    if (!frameId) return onDesignChange(null);
    onDesignChange(
      design ? { ...design, frameId } : { ...DEFAULT_DESIGN, frameId },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="a-label mb-0">Look</p>
          <button
            className="text-xs text-[var(--a-muted)] hover:text-[var(--a-ink)] hover:underline"
            onClick={() => setManaging(true)}
          >
            Manage frames
          </button>
        </div>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Email look"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!design}
            onClick={() => pickFrame(null)}
            className={`flex h-[86px] flex-col justify-end rounded-lg border p-2 text-left text-sm ${
              !design
                ? "border-[var(--a-ink)] ring-1 ring-[var(--a-ink)]"
                : "border-[var(--a-line)] hover:border-[var(--a-line-strong)]"
            }`}
          >
            <span className="font-medium text-[var(--a-ink)]">
              Standard letter
            </span>
            <span className="text-xs text-[var(--a-muted)]">
              Plain branded email
            </span>
          </button>
          {frames.map((frame) => {
            const active = design?.frameId === frame.id;
            return (
              <button
                key={frame.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickFrame(frame.id)}
                className={`relative h-[86px] overflow-hidden rounded-lg border text-left ${
                  active
                    ? "border-[var(--a-ink)] ring-1 ring-[var(--a-ink)]"
                    : "border-[var(--a-line)] hover:border-[var(--a-line-strong)]"
                }`}
                style={{ background: frame.pageColor }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.headerImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-sm font-medium text-white">
                  {frame.name}
                </span>
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--a-ink)]">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {design && (
        <div className="a-panel space-y-4">
          <label className="block">
            <span className="a-label">Headline</span>
            <input
              className="a-input"
              value={design.headline}
              onChange={(e) => set({ headline: e.target.value })}
              placeholder="Candle season is finally here"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="a-label">Offer (optional)</span>
              <input
                className="a-input"
                value={design.offer ?? ""}
                onChange={(e) => set({ offer: e.target.value })}
                placeholder="Buy one, get the second 50% off"
              />
            </label>
            <label className="block">
              <span className="a-label">Promo code</span>
              <input
                className="a-input font-mono uppercase"
                value={design.code ?? ""}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                placeholder="GIFTEARLY"
              />
            </label>
            <label className="block">
              <span className="a-label">Ends</span>
              <input
                className="a-input"
                value={design.endsText ?? ""}
                onChange={(e) => set({ endsText: e.target.value })}
                placeholder="Ends Sunday, November 15"
              />
            </label>
            <label className="block">
              <span className="a-label">Button text</span>
              <input
                className="a-input"
                value={design.ctaLabel ?? ""}
                onChange={(e) => set({ ctaLabel: e.target.value })}
                placeholder="Shop the sale"
              />
            </label>
            <label className="block">
              <span className="a-label">Button link</span>
              <input
                className="a-input"
                value={design.ctaUrl ?? ""}
                onChange={(e) => set({ ctaUrl: e.target.value })}
                placeholder="/shop"
              />
            </label>
          </div>

          <div>
            <p className="a-label">Featured products (up to 3)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <select
                  key={i}
                  className="a-select"
                  value={design.productSlugs[i] ?? ""}
                  onChange={(e) => {
                    const next = [...design.productSlugs];
                    next[i] = e.target.value;
                    set({ productSlugs: next.filter(Boolean) });
                  }}
                  aria-label={`Featured product ${i + 1}`}
                >
                  <option value="">None</option>
                  {products.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--a-ink)]">
            <Switch
              checked={design.pickupNote}
              onChange={() => set({ pickupNote: !design.pickupNote })}
              label="Free local pickup line"
            />
            Mention free local pickup in Scottsdale
          </label>
        </div>
      )}

      {/* Portal out of the compose card (the sticky preview column paints over it), but stay
          inside the .admin shell, which defines the admin colour tokens. */}
      {managing &&
        createPortal(
          <ManageFrames
            frames={frames}
            onClose={() => setManaging(false)}
            onChanged={onFramesChanged}
          />,
          document.querySelector(".admin") ?? document.body,
        )}
    </div>
  );
}

const NEW_FRAME = {
  name: "",
  headerImageUrl: "",
  footerImageUrl: "",
  eyebrow: "",
  productsHeading: "",
  pageColor: "#3a2a20",
  cardColor: "#fdf8ef",
  panelColor: "#f6ead3",
  accentColor: "#9c4221",
  secondaryColor: "#5a6438",
  textColor: "#211a16",
};

const COLOR_FIELDS: { key: keyof typeof NEW_FRAME; label: string }[] = [
  { key: "pageColor", label: "Page background" },
  { key: "cardColor", label: "Card (match footer art)" },
  { key: "panelColor", label: "Offer panel" },
  { key: "accentColor", label: "Buttons and code" },
  { key: "secondaryColor", label: "Label and pickup box" },
  { key: "textColor", label: "Text" },
];

function ManageFrames({
  frames,
  onClose,
  onChanged,
}: {
  frames: EmailFrame[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<typeof NEW_FRAME | null>(null);
  const [uploading, setUploading] = useState<"header" | "footer" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (which: "header" | "footer", file: File) => {
    setUploading(which);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setDraft(
        (d) =>
          d && {
            ...d,
            [which === "header" ? "headerImageUrl" : "footerImageUrl"]:
              data.url,
          },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save frame");
      setDraft(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save frame");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (frame: EmailFrame) => {
    if (
      !confirm(
        `Delete the "${frame.name}" frame? Templates using it will fall back to the standard letter.`,
      )
    )
      return;
    await fetch(`/api/admin/email-frames?id=${encodeURIComponent(frame.id)}`, {
      method: "DELETE",
    });
    onChanged();
  };

  return (
    <Modal
      size="lg"
      title="Email frames"
      description="A frame is festive artwork plus colours that wrap your message. Upload a wide header image (about 2:1) and, optionally, a border for the bottom."
      onClose={onClose}
      busy={saving}
      footer={
        draft ? (
          <>
            <button
              className="a-btn"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="a-btn a-btn-primary"
              onClick={save}
              disabled={saving || !draft.name.trim() || !draft.headerImageUrl}
            >
              {saving ? "Saving…" : "Save frame"}
            </button>
          </>
        ) : (
          <button
            className="a-btn a-btn-primary"
            onClick={() => setDraft({ ...NEW_FRAME })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New frame
          </button>
        )
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-[#fdecea] p-3 text-sm text-[#7a1a12]">
          {error}
        </p>
      )}

      {draft ? (
        <div className="space-y-4">
          <label className="block">
            <span className="a-label">Name</span>
            <input
              className="a-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Valentine's Day"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["header", "footer"] as const).map((which) => {
              const url =
                which === "header"
                  ? draft.headerImageUrl
                  : draft.footerImageUrl;
              return (
                <div key={which}>
                  <p className="a-label">
                    {which === "header"
                      ? "Header artwork (required)"
                      : "Footer border (optional)"}
                  </p>
                  <label className="flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--a-line-strong)] bg-[var(--a-canvas)] text-sm text-[var(--a-muted)] hover:text-[var(--a-ink)]">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center gap-2">
                        <ImagePlus className="h-4 w-4" aria-hidden />
                        {uploading === which ? "Uploading…" : "Choose image"}
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) =>
                        e.target.files?.[0] && upload(which, e.target.files[0])
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="a-label">Label above headline</span>
              <input
                className="a-input"
                value={draft.eyebrow}
                onChange={(e) =>
                  setDraft({ ...draft, eyebrow: e.target.value })
                }
                placeholder="Fall in Scottsdale"
              />
            </label>
            <label className="block">
              <span className="a-label">Featured products heading</span>
              <input
                className="a-input"
                value={draft.productsHeading}
                onChange={(e) =>
                  setDraft({ ...draft, productsHeading: e.target.value })
                }
                placeholder="Picked for fall"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-[var(--a-ink)]"
              >
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-[var(--a-line)] bg-white p-0.5"
                />
                <span className="leading-tight">{label}</span>
              </label>
            ))}
          </div>
          <p className="a-help">
            Tip: generate artwork without any text in it, and give the footer
            border a flat background in the card colour so it blends in.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {frames.map((frame) => (
            <li
              key={frame.id}
              className="overflow-hidden rounded-lg border border-[var(--a-line)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.headerImageUrl}
                alt=""
                className="h-28 w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--a-ink)]">
                    {frame.name}
                  </p>
                  <div className="mt-1 flex gap-1">
                    {[
                      frame.pageColor,
                      frame.cardColor,
                      frame.accentColor,
                      frame.secondaryColor,
                    ].map((c, i) => (
                      <span
                        key={i}
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                {frame.builtIn ? (
                  <span className="text-xs text-[var(--a-faint)]">
                    Built in
                  </span>
                ) : (
                  <button
                    className="a-icon-btn a-icon-btn-danger h-8 w-8"
                    onClick={() => remove(frame)}
                    aria-label={`Delete ${frame.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
