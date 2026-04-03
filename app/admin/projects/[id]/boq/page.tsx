"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  BOQVersion,
  BOQVersionDetail,
  BOQSectionWithItems,
} from "@/lib/boq-management/types";

// ---------------------------------------------------------------------------
// Shared response shape used across the app
// ---------------------------------------------------------------------------
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function truncate(str: string, max = 120): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BOQManagementPage() {
  const params = useParams();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [projectName, setProjectName] = useState("");
  const [versions, setVersions] = useState<BOQVersion[]>([]);
  const [activeDetail, setActiveDetail] = useState<BOQVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Expanded sections (tracks which section IDs are expanded)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // -- Data fetching ---------------------------------------------------------

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const json = await res.json();
      if (json.success && json.data?.name) setProjectName(json.data.name);
    } catch {
      /* non-critical */
    }
  }, [projectId]);

  const fetchVersions = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/boq`);
    const json: ApiResponse<BOQVersion[]> = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load BOQ versions");
    setVersions(json.data ?? []);
    return json.data ?? [];
  }, [projectId]);

  const fetchVersionDetail = useCallback(async (versionId: string) => {
    const res = await fetch(`/api/projects/${projectId}/boq/${versionId}`);
    const json: ApiResponse<BOQVersionDetail> = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load BOQ details");
    setActiveDetail(json.data ?? null);
    // Auto-expand all sections on first load
    if (json.data?.sections) {
      setExpandedSections(new Set(json.data.sections.map((s) => s.id)));
    }
  }, [projectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Why: BOQ core flow now focuses on import/version/items, so we avoid area-mapping fetches here.
      const [vList] = await Promise.all([fetchVersions(), fetchProject()]);
      // Auto-load the active version detail
      const active = vList.find((v) => v.isActive);
      if (active) await fetchVersionDetail(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchVersions, fetchProject, fetchVersionDetail]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // -- Upload handler --------------------------------------------------------

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/projects/${projectId}/boq`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      setUploadSuccess(
        `Imported ${json.data.itemsImported} items in ${json.data.sectionsImported} sections — ${formatCurrency(json.data.totalAmount)}`
      );

      // Refresh data
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // -- Section expand / collapse ---------------------------------------------

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const expandAll = () => {
    if (activeDetail?.sections) {
      setExpandedSections(new Set(activeDetail.sections.map((s) => s.id)));
    }
  };

  const collapseAll = () => setExpandedSections(new Set());

  // -- Render helpers --------------------------------------------------------

  const renderSectionItems = (section: BOQSectionWithItems) => {
    const isExpanded = expandedSections.has(section.id);
    return (
      <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">{isExpanded ? "▼" : "▶"}</span>
            <span className="font-medium text-gray-800">{section.name}</span>
            <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
              {section.items.length} item{section.items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-2 font-medium w-16">#</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium w-28">SAP Code</th>
                  <th className="px-4 py-2 font-medium w-16">Unit</th>
                  <th className="px-4 py-2 font-medium w-24 text-right">Qty</th>
                  <th className="px-4 py-2 font-medium w-24 text-right">Rate</th>
                  <th className="px-4 py-2 font-medium w-28 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {section.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{item.itemNumber}</td>
                    <td className="px-4 py-2 text-gray-900 max-w-md">
                      <span title={item.description}>
                        {truncate(item.description)}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-600 text-xs">
                      {item.sapCode ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{item.unit ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {item.quantity.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // -- Main layout -----------------------------------------------------------

  const backHref = `/admin/projects/${projectId}/details`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={backHref} className="text-green-600 hover:text-green-700">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">
            Bill of Quantities
            {projectName && (
              <span className="font-normal text-gray-500 ml-2">– {projectName}</span>
            )}
          </h1>
          <div>
            <label
              htmlFor="boq-upload"
              className={`inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                uploading ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {uploading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                  Importing…
                </>
              ) : (
                "Upload BOQ"
              )}
            </label>
            <input
              ref={fileInputRef}
              id="boq-upload"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              Dismiss
            </button>
          </div>
        )}
        {uploadSuccess && (
          <div
            role="status"
            className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between"
          >
            <span>{uploadSuccess}</span>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-green-500 hover:text-green-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent mb-2" />
            <p>Loading BOQ data…</p>
          </div>
        ) : versions.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-4xl mb-4 text-gray-300">📋</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No BOQ uploaded yet</h2>
            <p className="text-gray-500 mb-6">
              Upload an Excel (.xlsx) file to import a Bill of Quantities for this project.
            </p>
            <label
              htmlFor="boq-upload"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Upload BOQ
            </label>
          </div>
        ) : (
          <>
            {/* Version history bar */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    Version {activeDetail?.versionNumber ?? "—"}
                    {activeDetail?.isActive && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">
                        Active
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {activeDetail?.fileName ?? ""}{" "}
                    {activeDetail && `· Uploaded ${formatDate(activeDetail.createdAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {activeDetail?.itemCount ?? 0}
                    </p>
                    <p className="text-gray-500">Items</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {activeDetail?.sections?.length ?? 0}
                    </p>
                    <p className="text-gray-500">Sections</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(activeDetail?.totalAmount)}
                    </p>
                    <p className="text-gray-500">Total</p>
                  </div>
                </div>
              </div>

              {/* Version dropdown for history */}
              {versions.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label htmlFor="version-select" className="text-xs text-gray-500 mr-2">
                    View version:
                  </label>
                  <select
                    id="version-select"
                    className="text-sm border border-gray-300 rounded-md px-2 py-1"
                    value={activeDetail?.id ?? ""}
                    onChange={async (e) => {
                      setLoading(true);
                      try {
                        await fetchVersionDetail(e.target.value);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to load version");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber} — {v.fileName}
                        {v.isActive ? " (active)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Section list with items */}
            {activeDetail && activeDetail.sections.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">BOQ Items by Section</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Expand all
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Collapse all
                    </button>
                  </div>
                </div>

                {activeDetail.sections.map(renderSectionItems)}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
