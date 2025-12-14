"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import QRCode from "qrcode";

/* ---------- Types ---------- */
type AlcoholType = { id: string; name: string; sortOrder?: number };

type Container = {
  id: string;
  name: string;
  capacityWaterOz: number;
  shape: string;
  supplier?: string;
  costPerUnit: number;
  notes?: string;
};

type CalculatorSettings = {
  waxCostPerOz: number;
  waterToWaxRatio: number;
  defaultFragranceLoad: number;
};

type WickType = {
  id: string;
  name: string;
};

type GlobalScent = {
  id: string;
  name: string;
  limited: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
};

type VariantConfig = {
  wickTypes: WickType[];
  // scents are now global - not stored per product
  variantData: Record<string, { stock: number }>;
};

type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  images?: string[]; // Multiple images support
  sku: string;
  stripePriceId?: string;
  seoDescription: string;
  bestSeller?: boolean;
  youngDumb?: boolean;
  stock: number;
  variantConfig?: VariantConfig;
  alcoholType?: string;
  materialCost?: number; // Cost to make the product (from calculator)
  visibleOnWebsite?: boolean; // Controls shop page visibility
  containerId?: string; // Reference to container used for this product
};

/* ---------- Helpers ---------- */
function emptyProduct(): Product {
  return {
    slug: "",
    name: "",
    price: 0,
    image: "",
    images: [],
    sku: "",
    stripePriceId: "",
    seoDescription: "",
    bestSeller: false,
    youngDumb: false,
    stock: 0,
    alcoholType: "Other", // NEW default
    visibleOnWebsite: true, // Default to visible
    variantConfig: {
      wickTypes: [{ id: "standard", name: "Standard Wick" }],
      variantData: {},
    },
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** parse "DCW-0015" -> { prefix: "DCW-", num: 15, width: 4 } */
function parseSku(sku: string) {
  const m = sku.match(/^([A-Za-z]+-?)(\d+)$/);
  if (!m) return { prefix: "DCW-", num: 0, width: 4 };
  return { prefix: m[1], num: Number(m[2]), width: m[2].length };
}

/** From existing items + staged drafts, compute next SKU like DCW-0016 */
function computeNextSku(allSkus: string[]): string {
  if (allSkus.length === 0) return "DCW-0001";
  let best = { prefix: "DCW-", num: 0, width: 4 };
  for (const s of allSkus) {
    const p = parseSku(s);
    if (p.num > best.num) best = p;
  }
  const next = best.num + 1;
  const padded = String(next).padStart(best.width, "0");
  return `${best.prefix}${padded}`;
}

function getTotalStock(p: Product): number {
  if (p.variantConfig) {
    const { variantData } = p.variantConfig;
    let total = 0;
    for (const data of Object.values(variantData)) {
      total += data.stock ?? 0;
    }
    return total;
  }
  return p.stock ?? 0;
}

function generateVariantsForDisplay(p: Product, globalScents: GlobalScent[]) {
  if (!p.variantConfig) return [];

  const { wickTypes, variantData } = p.variantConfig;
  const variants: Array<{
    id: string;
    wickName: string;
    scentName: string;
    stock: number;
  }> = [];

  // Filter scents based on limited flag and enabled products
  const availableScents = globalScents.filter((scent) => {
    if (!scent.limited) return true;
    return scent.enabledProducts?.includes(p.slug) ?? false;
  });

  for (const wick of wickTypes) {
    for (const scent of availableScents) {
      const variantId = `${wick.id}-${scent.id}`;
      const data = variantData[variantId] || { stock: 0 };
      variants.push({
        id: variantId,
        wickName: wick.name,
        scentName: scent.name,
        stock: data.stock,
      });
    }
  }

  return variants;
}

/**
 * Auto-generate product description based on product name and container
 */
function generateDescription(
  productName: string,
  container: Container | undefined,
  waterToWaxRatio: number
): string {
  // Extract bottle name by removing " Candle" suffix
  const bottleName = productName.replace(/\s+Candle$/i, "").trim();

  // Calculate wax ounces if container is selected
  let waxOzText = "[Select container to calculate]";
  if (container) {
    const waxOz = container.capacityWaterOz * waterToWaxRatio;
    waxOzText = `${Math.round(waxOz)} oz wax`;
  }

  return `Hand-poured candle in an upcycled ${bottleName} bottle.

Golden Brands 454 Coconut Soy Wax

Approx. - ${waxOzText}`;
}

/* ---------- Component ---------- */
export default function AdminProductsPage() {
  const { showAlert, showConfirm, showPrompt } = useModal();
  const [items, setItems] = useState<Product[]>([]);
  const [globalScents, setGlobalScents] = useState<GlobalScent[]>([]);
  const [alcoholTypes, setAlcoholTypes] = useState<AlcoholType[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [settings, setSettings] = useState<CalculatorSettings>({
    waxCostPerOz: 0,
    waterToWaxRatio: 0.9,
    defaultFragranceLoad: 0.1,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New filter and sort states
  const [visibleFilter, setVisibleFilter] = useState<"all" | "visible" | "hidden">("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]); // Changed to array for multi-select
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [bestFilter, setBestFilter] = useState<"all" | "best" | "not-best">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "cost" | "stock" | "best" | "status" | "none">("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // Staged local drafts keyed by slug (full product objects)
  const [staged, setStaged] = useState<Record<string, Product>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  // QR code upload state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrDataURL, setQRDataURL] = useState<string | null>(null);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [productsRes, scentsRes, typesRes, containersRes, settingsRes] = await Promise.all([
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/scents", { cache: "no-store" }),
        fetch("/api/admin/alcohol-types?active=1", { cache: "no-store" }),
        fetch("/api/admin/containers", { cache: "no-store" }),
        fetch("/api/admin/calculator-settings", { cache: "no-store" })
      ]);

      if (productsRes.ok) {
        const productsData = (await productsRes.json()) as { items?: Product[] };
        setItems(productsData.items || []);
      }

      if (scentsRes.ok) {
        const scentsData = (await scentsRes.json()) as { scents?: GlobalScent[] };
        setGlobalScents(scentsData.scents || []);
      }

      if (typesRes.ok) {
        const typesData = (await typesRes.json()) as { types?: AlcoholType[] };
        setAlcoholTypes(typesData.types || []);
      }

      if (containersRes.ok) {
        const containersData = (await containersRes.json()) as { containers?: Container[] };
        console.log("[Products] Loaded containers:", containersData.containers);
        setContainers(containersData.containers || []);
      } else {
        console.error("[Products] Failed to load containers:", await containersRes.text());
      }

      if (settingsRes.ok) {
        const settingsData = (await settingsRes.json()) as CalculatorSettings | { settings?: CalculatorSettings };
        // Handle settings response (could be direct object or wrapped)
        if ('waterToWaxRatio' in settingsData) {
          setSettings(settingsData as CalculatorSettings);
        } else if ('settings' in settingsData && settingsData.settings) {
          setSettings(settingsData.settings);
        }
      }
    } catch (error) {
      console.error("[Products] Load error:", error);
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  // Close type dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (typeDropdownOpen && !target.closest(".type-filter-dropdown")) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeDropdownOpen]);

  const isServerItem = (slug: string) => items.some((x) => x.slug === slug);
  const hasDraft = (slug: string) => staged[slug] !== undefined;

  // merged view = server items overlayed with staged changes/new items
  const merged = useMemo(() => {
    const bySlug = new Map<string, Product>();
    for (const p of items) bySlug.set(p.slug, p);
    for (const [slug, p] of Object.entries(staged)) bySlug.set(slug, p);
    return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, staged]);

  const filtered = useMemo(() => {
    let result = [...merged];

    // Text search filter
    const q = filter.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    // Visible filter
    if (visibleFilter === "visible") {
      result = result.filter((p) => p.visibleOnWebsite !== false);
    } else if (visibleFilter === "hidden") {
      result = result.filter((p) => p.visibleOnWebsite === false);
    }

    // Type filter (multi-select)
    if (typeFilter.length > 0) {
      result = result.filter((p) => {
        const productType = p.alcoholType || "Other";
        return typeFilter.includes(productType);
      });
    }

    // Stock filter
    if (stockFilter === "in-stock") {
      result = result.filter((p) => getTotalStock(p) > 0);
    } else if (stockFilter === "out-of-stock") {
      result = result.filter((p) => getTotalStock(p) === 0);
    }

    // Best seller filter
    if (bestFilter === "best") {
      result = result.filter((p) => p.bestSeller === true);
    } else if (bestFilter === "not-best") {
      result = result.filter((p) => p.bestSeller !== true);
    }

    // Status filter
    if (statusFilter === "published") {
      result = result.filter((p) => !hasDraft(p.slug));
    } else if (statusFilter === "draft") {
      result = result.filter((p) => hasDraft(p.slug));
    }

    // Sorting
    if (sortBy !== "none") {
      result.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "price":
            comparison = a.price - b.price;
            break;
          case "cost":
            comparison = (a.materialCost || 0) - (b.materialCost || 0);
            break;
          case "stock":
            comparison = getTotalStock(a) - getTotalStock(b);
            break;
          case "best":
            comparison = (a.bestSeller ? 1 : 0) - (b.bestSeller ? 1 : 0);
            break;
          case "status":
            comparison = (hasDraft(a.slug) ? 1 : 0) - (hasDraft(b.slug) ? 1 : 0);
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [merged, filter, visibleFilter, typeFilter, stockFilter, bestFilter, statusFilter, sortBy, sortDirection, staged]);

  /* ---------- Sorting Helper ---------- */

  function handleSort(column: typeof sortBy) {
    if (column === "none") return;

    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortBy(column);
      setSortDirection("asc");
    }
  }

  function SortableHeader({
    column,
    children,
    className = ""
  }: {
    column: typeof sortBy;
    children: React.ReactNode;
    className?: string;
  }) {
    if (column === "none") {
      return <th className={`py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wide ${className}`}>{children}</th>;
    }

    const isActive = sortBy === column;
    const arrow = isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

    return (
      <th className={`py-3 ${className}`}>
        <button
          className="w-full text-xs font-semibold text-neutral-600 uppercase tracking-wide hover:text-[var(--color-accent)] transition-colors whitespace-nowrap"
          onClick={() => handleSort(column)}
        >
          {children}{arrow}
        </button>
      </th>
    );
  }

  /* ---------- CSV Export ---------- */

  function exportToCSV() {
    const headers = [
      "Name",
      "Slug",
      "SKU",
      "Price",
      "Material Cost",
      "Alcohol Type",
      "Stock (Total)",
      "Base Stock",
      "Visible on Website",
      "Best Seller",
      "Young & Dumb",
      "Status",
      "Stripe Price ID",
      "Description",
      "Has Variants",
      "Wick Types",
      "Variant Stock Details",
    ];

    const rows = filtered.map((p) => {
      // Get wick types if product has variants
      const wickTypes = p.variantConfig?.wickTypes
        ? p.variantConfig.wickTypes.map((w) => w.name).join("; ")
        : "";

      // Get variant stock details
      let variantStockDetails = "";
      if (p.variantConfig) {
        const variants = generateVariantsForDisplay(p, globalScents);
        variantStockDetails = variants
          .filter((v) => v.stock > 0)
          .map((v) => `${v.wickName}/${v.scentName}: ${v.stock}`)
          .join("; ");
      }

      return [
        p.name,
        p.slug,
        p.sku || "",
        p.price.toFixed(2),
        p.materialCost ? p.materialCost.toFixed(2) : "",
        p.alcoholType || "Other",
        getTotalStock(p).toString(),
        p.stock.toString(),
        p.visibleOnWebsite !== false ? "Yes" : "No",
        p.bestSeller ? "Yes" : "No",
        p.youngDumb ? "Yes" : "No",
        hasDraft(p.slug) ? "Draft" : "Published",
        p.stripePriceId || "",
        p.seoDescription || "",
        p.variantConfig ? "Yes" : "No",
        wickTypes,
        variantStockDetails,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `products-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ---------- Drafting & Publishing ---------- */

  // Stage (no network): create/replace a draft for slug
  function stageProduct(p: Product) {
    const slug = (p.slug || "").trim();
    if (!slug) {
      setSlugError("Slug is required");
      return;
    }
    if (!SLUG_REGEX.test(slug)) {
      setSlugError("Use lowercase letters/numbers with single hyphens");
      return;
    }
    setSlugError(null);
    setStaged((prev) => ({ ...prev, [slug]: { ...p, slug } }));
  }

  // Remove a staged draft (undo)
  function discardDraft(slug: string) {
    setStaged((prev) => {
      const copy = { ...prev };
      delete copy[slug];
      return copy;
    });
  }

  // Publish a single product: POST (new) or PATCH (existing)
  async function publishOne(slug: string) {
    const draft = staged[slug];
    if (!draft) return;

    console.log("[Admin] Publishing product:", slug, draft);

    setSaving(true);
    setError(null);

    const isNew = !isServerItem(slug);
    console.log(`[Admin] ${isNew ? 'Creating new' : 'Updating existing'} product`);

    const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    console.log("[Admin] Response status:", res.status);

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      console.error("[Admin] Publish failed:", j);
      const errorMsg = j.error || `Publish failed (${res.status})`;
      setError(errorMsg);
      await showAlert(`Failed to publish product:\n\n${errorMsg}`, "Error");
    } else {
      console.log("[Admin] Publish successful");
      discardDraft(slug);
      await load();
    }
    setSaving(false);
  }

  // Publish all drafts
  async function publishAll() {
    const slugs = Object.keys(staged);
    setSaving(true);
    setError(null);
    for (const slug of slugs) {
      const isNew = !isServerItem(slug);
      const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staged[slug]),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const errorMsg = j.error || `Publish failed for ${slug}`;
        setError(errorMsg);
        await showAlert(`Failed to publish product "${slug}":\n\n${errorMsg}`, "Error");
        setSaving(false);
        return; // stop on first failure
      }
    }
    setStaged({});
    await load();
    setSaving(false);
  }

  // Delete (server)
  async function deleteProduct(slug: string) {
    const confirmed = await showConfirm(`Delete ${slug}?`, "Confirm Delete");
    if (!confirmed) return;
    discardDraft(slug);
    const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  // Image upload (supports multiple images)
  async function handleImagePick(
    e: React.ChangeEvent<HTMLInputElement>,
    editingLocal: Product | null,
    setEditingLocal: (v: Product) => void
  ) {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingLocal) return;

    console.log(`[Admin] Starting upload of ${files.length} image(s)`);

    try {
      const uploadedUrls: string[] = [];

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`[Admin] Uploading image ${i + 1}/${files.length}:`, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });

        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error("[Admin] Upload failed:", errorData);
          await showAlert(`Upload failed for ${file.name}: ${errorData.error || "Unknown error"}\n${errorData.details || ""}`, "Upload Error");
          continue; // Continue with other files
        }

        const { url } = (await res.json()) as { url: string };
        console.log(`[Admin] Upload ${i + 1} successful, URL:`, url);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length > 0) {
        // Append to existing images array
        const currentImages = editingLocal.images || [];
        setEditingLocal({
          ...editingLocal,
          images: [...currentImages, ...uploadedUrls],
          // Keep legacy image field pointing to first image for backward compatibility
          image: currentImages.length === 0 && uploadedUrls.length > 0 ? uploadedUrls[0] : editingLocal.image
        });
      }
    } catch (error) {
      console.error("[Admin] Upload error:", error);
      await showAlert(`Upload failed: ${error instanceof Error ? error.message : "Network error"}`, "Upload Error");
    }
  }

  // Remove image from array
  function removeImage(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal) return;
    const newImages = [...(editingLocal.images || [])];
    newImages.splice(index, 1);
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      // Update legacy image field
      image: newImages.length > 0 ? newImages[0] : undefined
    });
  }

  // Reorder images (move up)
  function moveImageUp(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal || index === 0) return;
    const newImages = [...(editingLocal.images || [])];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      image: newImages[0]
    });
  }

  // Reorder images (move down)
  function moveImageDown(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal || !editingLocal.images || index === editingLocal.images.length - 1) return;
    const newImages = [...editingLocal.images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      image: newImages[0]
    });
  }

  // QR code upload functions
  async function startQRUpload() {
    try {
      // Create upload session
      const res = await fetch("/api/admin/create-upload-session", {
        method: "POST",
      });

      if (!res.ok) {
        await showAlert("Failed to create upload session", "Error");
        return;
      }

      const { token } = await res.json();
      setUploadToken(token);
      setUploadedCount(0);

      // Generate QR code
      const origin = window.location.origin;
      const uploadUrl = `${origin}/mobile-upload?token=${token}`;
      const qrData = await QRCode.toDataURL(uploadUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQRDataURL(qrData);
      setShowQRModal(true);

      // Start polling for uploaded images
      startPolling(token);
    } catch (error) {
      console.error("[QR Upload] Error:", error);
      await showAlert("Failed to generate QR code", "Error");
    }
  }

  function startPolling(token: string) {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mobile-upload/status?token=${token}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.valid && data.uploadedCount > uploadedCount) {
          setUploadedCount(data.uploadedCount);

          // Fetch the full session to get image URLs
          const sessionRes = await fetch(`/api/admin/get-upload-session?token=${token}`);
          if (!sessionRes.ok) return;

          const sessionData = await sessionRes.json();
          if (sessionData.uploadedImages && editing) {
            const currentImages = editing.images || [];
            const newImages = sessionData.uploadedImages.filter(
              (url: string) => !currentImages.includes(url)
            );

            if (newImages.length > 0) {
              setEditing({
                ...editing,
                images: [...currentImages, ...newImages],
                image: currentImages.length === 0 ? newImages[0] : editing.image,
              });
            }
          }
        }
      } catch (error) {
        console.error("[QR Upload] Polling error:", error);
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  function closeQRModal() {
    stopPolling();
    setShowQRModal(false);
    setQRDataURL(null);
    setUploadToken(null);
    setUploadedCount(0);
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Next SKU for new product modal
  const nextSku = useMemo(() => {
    const allSkus = [...items.map((i) => i.sku), ...Object.values(staged).map((d) => d.sku)].filter(
      Boolean
    );
    return computeNextSku(allSkus);
  }, [items, staged]);

  /* ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-[1800px] p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(staged).length > 0 && (
            <>
              <button className="btn" onClick={() => setStaged({})} disabled={saving}>
                Discard all
              </button>
              <button className="btn btn-primary" onClick={publishAll} disabled={saving}>
                {saving ? "Publishing…" : `Publish all (${Object.keys(staged).length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter + New */}
      {/* Search and Controls */}
      <div className="mt-4 space-y-4">
        {/* Search and Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            className="input flex-1 sm:max-w-md"
            placeholder="Search by name, slug, or SKU…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            className="btn bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto"
            onClick={exportToCSV}
            disabled={filtered.length === 0}
          >
            Export to CSV ({filtered.length})
          </button>
          <button
            className="btn btn-primary w-full sm:w-auto"
            onClick={() => {
              const p = emptyProduct();
              p.sku = nextSku; // default auto-increment
              setEditing(p);
              setSlugTouched(false);
              setSlugError(null);
              setError(null);
            }}
          >
            + New product
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Visible Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Visibility</label>
            <select
              className="input w-full text-sm"
              value={visibleFilter}
              onChange={(e) => setVisibleFilter(e.target.value as typeof visibleFilter)}
            >
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          {/* Type Filter - Multi-select */}
          <div className="relative type-filter-dropdown">
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Type</label>
            <button
              type="button"
              className="input w-full text-sm text-left flex items-center justify-between"
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
            >
              <span>
                {typeFilter.length === 0
                  ? "All Types"
                  : typeFilter.length === 1
                  ? typeFilter[0]
                  : `${typeFilter.length} selected`}
              </span>
              <span className="ml-2">▼</span>
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-[var(--color-line)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {/* Get unique types from active alcohol types */}
                {(() => {
                  const uniqueTypes = new Set<string>();
                  alcoholTypes.forEach((type) => uniqueTypes.add(type.name));
                  // Add "Other" only once if any products have it
                  if (merged.some((p) => !p.alcoholType || p.alcoholType === "Other")) {
                    uniqueTypes.add("Other");
                  }

                  return Array.from(uniqueTypes).sort().map((typeName) => (
                    <label
                      key={typeName}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={typeFilter.includes(typeName)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTypeFilter([...typeFilter, typeName]);
                          } else {
                            setTypeFilter(typeFilter.filter((t) => t !== typeName));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{typeName}</span>
                    </label>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Stock Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Stock</label>
            <select
              className="input w-full text-sm"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
            >
              <option value="all">All</option>
              <option value="in-stock">In Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>

          {/* Best Seller Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Best Seller</label>
            <select
              className="input w-full text-sm"
              value={bestFilter}
              onChange={(e) => setBestFilter(e.target.value as typeof bestFilter)}
            >
              <option value="all">All</option>
              <option value="best">Best Sellers</option>
              <option value="not-best">Not Best Sellers</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Status</label>
            <select
              className="input w-full text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="flex justify-end">
          <button
            className="btn w-full sm:w-auto text-sm"
            onClick={() => {
              setFilter("");
              setVisibleFilter("all");
              setTypeFilter([]);
              setStockFilter("all");
              setBestFilter("all");
              setStatusFilter("all");
              setSortBy("none");
              setSortDirection("asc");
            }}
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[var(--color-muted)]">Loading products…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-muted)]">No products found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-sm">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-neutral-50 to-neutral-100 border-b border-[var(--color-line)]">
                    <tr>
                      <SortableHeader column="none" className="w-20 text-center border-r border-[var(--color-line)]">
                        Visible
                      </SortableHeader>
                      <SortableHeader column="none" className="w-24 text-center border-r border-[var(--color-line)]">Image</SortableHeader>
                      <SortableHeader column="name" className="text-center border-r border-[var(--color-line)]">Name</SortableHeader>
                      <SortableHeader column="price" className="w-28 text-center border-r border-[var(--color-line)]">Price</SortableHeader>
                      <SortableHeader column="cost" className="w-36 text-center border-r border-[var(--color-line)]">Cost</SortableHeader>
                      <SortableHeader column="none" className="w-36 text-center border-r border-[var(--color-line)]">Type</SortableHeader>
                      <SortableHeader column="stock" className="w-28 text-center border-r border-[var(--color-line)]">Stock</SortableHeader>
                      <SortableHeader column="best" className="w-20 text-center border-r border-[var(--color-line)]">Best</SortableHeader>
                      <SortableHeader column="status" className="w-32 text-center border-r border-[var(--color-line)]">Status</SortableHeader>
                      <SortableHeader column="none" className="text-center">Actions</SortableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {filtered.map((p) => {
                      const isDraft = hasDraft(p.slug);
                      const profitMargin = p.materialCost && p.price > 0
                        ? (((p.price - p.materialCost) / p.price) * 100).toFixed(0)
                        : null;

                      return (
                        <tr key={p.slug} className="group hover:bg-neutral-50/50 transition-colors">
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <input
                              type="checkbox"
                              checked={p.visibleOnWebsite !== false}
                              onChange={(e) => {
                                const updated = { ...p, visibleOnWebsite: e.target.checked };
                                stageProduct(updated);
                              }}
                              className="w-4 h-4 text-[var(--color-accent)] rounded border-neutral-300 focus:ring-2 focus:ring-[var(--color-accent)]"
                              title={p.visibleOnWebsite !== false ? "Visible on shop" : "Hidden from shop"}
                            />
                          </td>
                          <td className="py-5 border-r border-[var(--color-line)]">
                            <div className="flex justify-center">
                              {(() => {
                                const img = p.images?.[0] ?? p.image;
                                return img ? (
                                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-neutral-100">
                                    <Image
                                      src={img}
                                      alt={p.name}
                                      fill
                                      sizes="64px"
                                      className="object-contain p-1"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-5 px-4 text-center border-r border-[var(--color-line)]">
                            <div className="font-medium text-[var(--color-ink)] text-sm">{p.name}</div>
                            <div className="text-xs text-[var(--color-muted)] mt-1">{p.slug}</div>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <div className="font-semibold text-[var(--color-ink)] text-sm">${p.price.toFixed(2)}</div>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            {p.materialCost ? (
                              <div>
                                <div className="font-medium text-[var(--color-ink)] text-sm">${p.materialCost.toFixed(2)}</div>
                                {profitMargin && (
                                  <div className="text-xs text-green-600 font-medium mt-0.5">+{profitMargin}%</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--color-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700">
                              {p.alcoholType ?? "Other"}
                            </span>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <div className="font-semibold text-[var(--color-ink)] text-sm">{getTotalStock(p)}</div>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            {p.bestSeller ? (
                              <span className="text-amber-500" title="Best Seller">
                                <svg className="w-5 h-5 inline" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            {isDraft ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Draft
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--color-muted)]">Published</span>
                            )}
                          </td>
                          <td className="py-5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="btn text-sm px-4 py-2"
                                onClick={() => {
                                  setEditing(p);
                                  setSlugTouched(true);
                                  setSlugError(null);
                                  setError(null);
                                }}
                              >
                                Edit
                              </button>

                              {isDraft && (
                                <>
                                  <button
                                    className="btn btn-primary text-sm px-4 py-2"
                                    disabled={saving}
                                    onClick={() => publishOne(p.slug)}
                                  >
                                    {saving ? "…" : "Publish"}
                                  </button>
                                  <button
                                    className="btn text-sm px-4 py-2"
                                    onClick={() => discardDraft(p.slug)}
                                  >
                                    Discard
                                  </button>
                                </>
                              )}

                              <button
                                className="btn text-sm px-4 py-2 text-red-600 hover:bg-red-50"
                                onClick={() => void deleteProduct(p.slug)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet card list */}
            <div className="lg:hidden space-y-3">
              {filtered.map((p) => {
                const isDraft = hasDraft(p.slug);
                return (
                  <div key={p.slug} className="card p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <input
                        type="checkbox"
                        checked={p.visibleOnWebsite !== false}
                        onChange={(e) => {
                          const updated = { ...p, visibleOnWebsite: e.target.checked };
                          stageProduct(updated);
                        }}
                        className="mt-1 w-4 h-4 text-[var(--color-accent)] rounded"
                        title={p.visibleOnWebsite !== false ? "Visible" : "Hidden"}
                      />
                      <div className="relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
                        {(() => {
                          const img = p.images?.[0] ?? p.image;
                          return img ? (
                            <Image src={img} alt="" fill sizes="64px" className="object-contain" />
                          ) : null;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-[var(--color-ink)] truncate">{p.name}</h3>
                          {p.bestSeller && <span className="text-amber-500">★</span>}
                        </div>
                        <div className="text-xs text-[var(--color-muted)]">{p.slug}</div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className="font-semibold">${p.price.toFixed(2)}</span>
                          <span className="text-[var(--color-muted)]">·</span>
                          <span>Stock: {getTotalStock(p)}</span>
                          {isDraft && <span className="badge">Draft</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--color-line)]">
                      <button
                        className="btn text-xs px-3 py-2 flex-1"
                        onClick={() => {
                          setEditing(p);
                          setSlugTouched(true);
                          setSlugError(null);
                          setError(null);
                        }}
                      >
                        Edit
                      </button>

                      {isDraft && (
                        <>
                          <button
                            className="btn btn-primary text-xs px-3 py-2"
                            disabled={saving}
                            onClick={() => publishOne(p.slug)}
                          >
                            {saving ? "…" : "Publish"}
                          </button>
                          <button className="btn text-xs px-3 py-2" onClick={() => discardDraft(p.slug)}>
                            Discard
                          </button>
                        </>
                      )}

                      <button className="btn text-xs px-3 py-2 text-red-600" onClick={() => void deleteProduct(p.slug)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ---------- Edit/Create Modal (scrollable on mobile) ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => {
              setEditing(null);
              setSlugTouched(false);
              setSlugError(null);
              setError(null);
            }}
          />
          {/* panel */}
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                  {isServerItem(editing.slug) ? "Edit Product" : "New Product"}
                </h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  {isServerItem(editing.slug) ? "Changes are staged until published" : "Configure product details and variants"}
                </p>
              </div>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={() => {
                  setEditing(null);
                  setSlugTouched(false);
                  setSlugError(null);
                  setError(null);
                }}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Basic Information Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <label className="block">
                    <div className="text-xs font-medium text-neutral-700 mb-2">Product Name</div>
                    <input
                      className="input"
                      value={editing.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEditing((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev, name };
                      if (!slugTouched && !isServerItem(prev.slug)) {
                        next.slug = slugify(name);
                        setSlugError(
                          next.slug && SLUG_REGEX.test(next.slug)
                            ? null
                            : "Use lowercase letters/numbers with single hyphens"
                        );
                      }
                      return next;
                    });
                  }}
                />
              </label>

                  {/* Slug */}
                  <label className="block">
                    <div className="text-xs font-medium text-neutral-700 mb-2">URL Slug</div>
                <input
                  className="input"
                  value={editing.slug}
                  disabled={isServerItem(editing.slug)} // keep URLs stable once published
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setSlugTouched(true);
                    setEditing({ ...editing, slug: v });
                    setSlugError(
                      v && SLUG_REGEX.test(v)
                        ? null
                        : "Use lowercase letters/numbers with single hyphens"
                    );
                  }}
                  onBlur={(e) => {
                    const cleaned = slugify(e.target.value);
                    setEditing((prev) => (prev ? { ...prev, slug: cleaned } : prev));
                    setSlugError(
                      cleaned && SLUG_REGEX.test(cleaned)
                        ? null
                        : "Use lowercase letters/numbers with single hyphens"
                    );
                  }}
                  placeholder="e.g. woodford-reserve-candle"
                />
                {slugError && <p className="text-rose-600 text-xs mt-1">{slugError}</p>}
              </label>

              {/* Price */}
              <label className="block">
                <div className="text-xs mb-1">Price</div>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </label>

              {/* SKU */}
              <label className="block">
                <div className="text-xs mb-1">SKU</div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={editing.sku}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                    placeholder="DCW-0001"
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              sku: computeNextSku([
                                ...items.map((i) => i.sku),
                                ...Object.values(staged).map((d) => d.sku),
                              ]),
                            }
                          : prev
                      )
                    }
                    title="Use next available SKU"
                  >
                    Auto
                  </button>
                </div>
              </label>

              {/* Alcohol Type — NEW */}
              <label className="block">
                <div className="text-xs mb-1">Alcohol Type</div>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={editing.alcoholType || ""}
                    onChange={async (e) => {
                      const v = e.target.value;
                      if (v === "__new__") {
                        const name = await showPrompt("Enter new alcohol type (e.g., Tequila):", "New Alcohol Type");
                        if (name && name.trim()) {
                          const res = await fetch("/api/admin/alcohol-types", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: name.trim() }),
                          });
                          if (res.ok) {
                            await load();
                            setEditing((prev) => (prev ? { ...prev, alcoholType: name.trim() } : prev));
                          } else {
                            await showAlert("Failed to create type", "Error");
                          }
                        }
                        return;
                      }
                      setEditing({ ...editing, alcoholType: v || undefined });
                    }}
                  >
                    <option value="">— Select type —</option>
                    {/* Active types only */}
                    {alcoholTypes.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                    {/* If the current product has an archived type, show it as disabled but visible */}
                    {editing.alcoholType &&
                      !alcoholTypes.some((t) => t.name === editing.alcoholType) && (
                        <option value={editing.alcoholType} disabled>
                          {editing.alcoholType} (archived)
                        </option>
                      )}
                    <option value="__new__">+ Add new type…</option>
                  </select>
                </div>
              </label>

              {/* Stripe Price ID */}
              <label className="block sm:col-span-2">
                <div className="text-xs mb-1">Stripe Price ID</div>
                <input
                  className="input"
                  value={editing.stripePriceId || ""}
                  onChange={(e) => setEditing({ ...editing, stripePriceId: e.target.value })}
                />
              </label>

              {/* Images - Multiple Upload */}
              <div className="block sm:col-span-2">
                <div className="text-xs mb-1">Product Images</div>
                <div className="flex gap-2">
                  <label className="btn cursor-pointer flex-1">
                    + Add Images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImagePick(e, editing, (v) => setEditing(v))}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                    onClick={startQRUpload}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Upload from Phone
                  </button>
                </div>

                {/* Display current images */}
                {editing.images && editing.images.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {editing.images.map((img, idx) => (
                      <div key={idx} className="card p-3 flex items-center gap-3">
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-white">
                          <Image src={img} alt={`Product image ${idx + 1}`} fill className="object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--color-muted)] truncate">{img}</div>
                          {idx === 0 && <span className="text-xs font-medium text-green-600">Primary</span>}
                        </div>
                        <div className="flex gap-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              className="btn text-xs px-2 py-1"
                              onClick={() => moveImageUp(idx, editing, (v) => setEditing(v))}
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          {editing.images && idx < editing.images.length - 1 && (
                            <button
                              type="button"
                              className="btn text-xs px-2 py-1"
                              onClick={() => moveImageDown(idx, editing, (v) => setEditing(v))}
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn text-xs px-2 py-1"
                            onClick={() => removeImage(idx, editing, (v) => setEditing(v))}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">No images yet. Click &quot;Add Images&quot; to upload.</p>
                )}
              </div>

              {/* Container Selection */}
              <label className="block">
                <div className="text-xs mb-1">Container (for description)</div>
                <select
                  className="input"
                  value={editing.containerId || ""}
                  onChange={(e) => setEditing({ ...editing, containerId: e.target.value || undefined })}
                >
                  <option value="">— Select container —</option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.capacityWaterOz} oz water)
                    </option>
                  ))}
                </select>
              </label>

              {/* Description */}
              <label className="block sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs">Description</span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => {
                      const container = containers.find((c) => c.id === editing.containerId);
                      const generatedDesc = generateDescription(editing.name, container, settings.waterToWaxRatio);
                      setEditing({ ...editing, seoDescription: generatedDesc });
                    }}
                  >
                    Auto-generate from name & container
                  </button>
                </div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={editing.seoDescription}
                  onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
                  placeholder="Select a container and click 'Auto-generate' or type manually"
                />
              </label>

              {/* Visible on Website */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.visibleOnWebsite !== false}
                  onChange={(e) => setEditing({ ...editing, visibleOnWebsite: e.target.checked })}
                />
                <span className="text-sm">Show on Website</span>
              </label>

              {/* Best Seller */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.bestSeller}
                  onChange={(e) => setEditing({ ...editing, bestSeller: e.target.checked })}
                />
                <span className="text-sm">Best Seller</span>
              </label>

              {/* Young & Dumb */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.youngDumb}
                  onChange={(e) => setEditing({ ...editing, youngDumb: e.target.checked })}
                />
                <span className="text-sm">Young & Dumb</span>
              </label>

              {/* Base Stock (disabled when variants used) */}
              <label className="block">
                <div className="text-xs mb-1">Stock (base, if not using variants)</div>
                <input
                  className="input"
                  type="number"
                  value={editing.stock}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      stock: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                  onBlur={(e) => {
                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                    setEditing({
                      ...editing,
                      stock: Math.max(0, val),
                    });
                  }}
                  disabled={!!editing.variantConfig}
                />
              </label>
            </div>
          </div>

              {/* ---------- Variants Section ---------- */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Product Variants
                </h3>

                {(() => {
                  // Auto-initialize variantConfig if it doesn't exist
                  if (!editing.variantConfig) {
                    setEditing({
                      ...editing,
                      variantConfig: {
                        wickTypes: [{ id: "standard", name: "Standard Wick" }],
                        variantData: {},
                      },
                    });
                    return null;
                  }

                  const availableScents = globalScents.filter((scent) => {
                    if (!scent.limited) return true;
                    return scent.enabledProducts?.includes(editing.slug) ?? false;
                  });
                  const variantsForDisplay = generateVariantsForDisplay(editing, globalScents);

                  return (
                    <div className="space-y-6">
                      {/* Wick Types Configuration */}
                      <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-neutral-900">Wick Types</h4>
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-3 py-1.5"
                            onClick={() => {
                              const newId = `wick-${Date.now()}`;
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  wickTypes: [
                                    ...editing.variantConfig!.wickTypes,
                                    { id: newId, name: "New Wick Type" },
                                  ],
                                },
                              });
                            }}
                          >
                            <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Wick
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {editing.variantConfig.wickTypes.map((wick, idx) => (
                            <div key={wick.id} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-neutral-200">
                              <input
                                className="input text-sm flex-1"
                                value={wick.name}
                                onChange={(e) => {
                                  const newWicks = [...editing.variantConfig!.wickTypes];
                                  newWicks[idx] = { ...wick, name: e.target.value };
                                  setEditing({
                                    ...editing,
                                    variantConfig: {
                                      ...editing.variantConfig!,
                                      wickTypes: newWicks,
                                    },
                                  });
                                }}
                                placeholder="e.g., Wood Wick"
                              />
                              <button
                                type="button"
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => {
                                  setEditing({
                                    ...editing,
                                    variantConfig: {
                                      ...editing.variantConfig!,
                                      wickTypes: editing.variantConfig!.wickTypes.filter((_, i) => i !== idx),
                                    },
                                  });
                                }}
                                title="Remove wick type"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Scents Info Banner */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 mb-1">Global Scents System</p>
                          <p className="text-xs text-blue-800">
                            Scents are managed globally and automatically appear as variants.{" "}
                            <a href="/admin/scents" className="font-medium underline hover:text-blue-900">
                              Manage scents →
                            </a>
                          </p>
                        </div>
                      </div>

                      {/* Variant Stock Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-medium text-neutral-900">
                            Inventory ({variantsForDisplay.length} variants)
                          </h4>
                          <div className="text-xs text-neutral-500">
                            {editing.variantConfig.wickTypes.length} wick × {availableScents.length} scents
                          </div>
                        </div>

                        {availableScents.length === 0 ? (
                          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                            <svg className="w-8 h-8 text-amber-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-sm font-medium text-amber-900 mb-1">No scents available</p>
                            <p className="text-xs text-amber-800">
                              <a href="/admin/scents" className="underline font-medium">
                                Add scents
                              </a>{" "}
                              to create product variants
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[400px] overflow-y-auto border border-neutral-200 rounded-xl">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
                              {variantsForDisplay.map((v) => (
                                <div key={v.id} className="bg-white border border-neutral-200 rounded-lg p-3 hover:border-[var(--color-accent)] hover:shadow-sm transition-all">
                                  <div className="text-xs font-medium text-neutral-900 mb-2 line-clamp-2" title={`${v.wickName} / ${v.scentName}`}>
                                    {v.scentName}
                                  </div>
                                  <div className="text-xs text-neutral-500 mb-2 truncate">{v.wickName}</div>
                                  <input
                                    className="input text-sm w-full"
                                    type="number"
                                    min="0"
                                    value={v.stock}
                                    placeholder="Stock"
                                    onChange={(e) => {
                                      const newData = { ...editing.variantConfig!.variantData };
                                      newData[v.id] = {
                                        stock: e.target.value === "" ? 0 : Number(e.target.value),
                                      };
                                      setEditing({
                                        ...editing,
                                        variantConfig: {
                                          ...editing.variantConfig!,
                                          variantData: newData,
                                        },
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                                      const newData = { ...editing.variantConfig!.variantData };
                                      newData[v.id] = {
                                        stock: Math.max(0, val),
                                      };
                                      setEditing({
                                        ...editing,
                                        variantConfig: {
                                          ...editing.variantConfig!,
                                          variantData: newData,
                                        },
                                      });
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                className="btn text-sm px-4 py-2"
                onClick={() => {
                  setEditing(null);
                  setSlugTouched(false);
                  setSlugError(null);
                  setError(null);
                }}
              >
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>

              <button
                className="btn btn-primary text-sm px-6 py-2"
                onClick={() => {
                  if (!editing) return;
                  stageProduct(editing);
                  setEditing(null);
                }}
              >
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && qrDataURL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={closeQRModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">Scan to Upload</h2>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={closeQRModal}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl border-2 border-neutral-200 mb-4">
              <img src={qrDataURL} alt="QR Code" className="w-full h-auto" />
            </div>

            {/* Instructions */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-xs">1</span>
                </div>
                <p className="text-neutral-700">Open your phone&apos;s camera app</p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-xs">2</span>
                </div>
                <p className="text-neutral-700">Point it at this QR code</p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-xs">3</span>
                </div>
                <p className="text-neutral-700">Select and upload photos from your phone</p>
              </div>
            </div>

            {/* Upload Status */}
            {uploadedCount > 0 && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    {uploadedCount} {uploadedCount === 1 ? "image" : "images"} uploaded
                  </p>
                  <p className="text-xs text-green-700">Images are being added to your product</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">Session expires in 5 minutes</p>
              <button
                className="btn btn-primary text-sm"
                onClick={closeQRModal}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}