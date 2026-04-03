"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_sequence: number;
  boq_version_id: string | null;
  created_at: string;
}

interface BillVersion {
  id: string;
  version_type: "generated" | "accepted";
  version_number: number;
  source: string;
  sub_total: number | null;
  tax_rate: number;
  tax_amount: number | null;
  grand_total: number | null;
  excel_url?: string | null;
  created_at: string;
}

interface MeasurementRow {
  id: string;
  area_name: string;
  boq_item_id: string;
  nos: number;
  length: number | null;
  breadth: number | null;
  depth: number | null;
  quantity: number;
  unit: string;
  measurement_date: string;
  remarks: string | null;
  is_deduction: boolean;
}

interface LinkedMeasurementRow {
  measurement_id: string;
  measurements: MeasurementRow | null;
}

interface BillDetailResponse {
  bill: Bill;
  latestGeneratedVersion: BillVersion | null;
  latestAcceptedVersion: BillVersion | null;
  linkedMeasurements: LinkedMeasurementRow[];
}

interface VersionDetailResponse {
  version: BillVersion;
  lineItems: Array<{
    boq_item_id: string;
    previous_quantity: number;
    current_quantity: number;
    cumulative_quantity: number;
    previous_amount: number;
    current_amount: number;
    cumulative_amount: number;
    rate: number;
    boq_items?: {
      item_number: number;
      description: string;
      sap_code: string | null;
      unit: string | null;
    } | null;
  }>;
}

interface ExportVersionResponse {
  fileName: string;
  mimeType: string;
  bytes: number;
  downloadUrl: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function VersionCard({
  title,
  version,
  details,
  onExport,
  isExporting,
}: {
  title: string;
  version: BillVersion | null;
  details: VersionDetailResponse | null;
  onExport: (() => void) | null;
  isExporting: boolean;
}) {
  if (!version) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-500">No version available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            v{version.version_number} • {version.source} • {formatDate(version.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={onExport ?? undefined}
          disabled={!onExport || isExporting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {isExporting ? "Exporting..." : "Export Excel"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
        <div className="bg-gray-50 rounded p-2">
          <p className="text-gray-500 text-xs">Sub Total</p>
          <p className="font-semibold text-gray-900">{formatCurrency(version.sub_total)}</p>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <p className="text-gray-500 text-xs">GST ({version.tax_rate}%)</p>
          <p className="font-semibold text-gray-900">{formatCurrency(version.tax_amount)}</p>
        </div>
        <div className="bg-green-50 rounded p-2">
          <p className="text-gray-500 text-xs">Grand Total</p>
          <p className="font-semibold text-green-700">{formatCurrency(version.grand_total)}</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Prev Qty</th>
              <th className="px-3 py-2 text-right font-medium">Curr Qty</th>
              <th className="px-3 py-2 text-right font-medium">Cum Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Curr Amt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(details?.lineItems ?? []).map((item) => (
              <tr key={item.boq_item_id}>
                <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">
                  #{item.boq_items?.item_number ?? "?"} {item.boq_items?.description ?? item.boq_item_id}
                </td>
                <td className="px-3 py-2 text-right">{formatQty(item.previous_quantity)}</td>
                <td className="px-3 py-2 text-right">{formatQty(item.current_quantity)}</td>
                <td className="px-3 py-2 text-right">{formatQty(item.cumulative_quantity)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.current_amount)}</td>
              </tr>
            ))}
            {(details?.lineItems.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No line items available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BillDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const billId = params.billId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bill, setBill] = useState<Bill | null>(null);
  const [generatedVersion, setGeneratedVersion] = useState<BillVersion | null>(null);
  const [acceptedVersion, setAcceptedVersion] = useState<BillVersion | null>(null);
  const [linkedMeasurements, setLinkedMeasurements] = useState<MeasurementRow[]>([]);
  const [generatedDetail, setGeneratedDetail] = useState<VersionDetailResponse | null>(null);
  const [acceptedDetail, setAcceptedDetail] = useState<VersionDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"generated" | "accepted">("generated");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadTaxRate, setUploadTaxRate] = useState("18");
  const [isUploading, setIsUploading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadBill = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/bills/${billId}`);
    const json: ApiResponse<BillDetailResponse> = await response.json();
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.error ?? "Failed to load bill");
    }

    const payload = json.data;
    setBill(payload.bill);
    setGeneratedVersion(payload.latestGeneratedVersion);
    setAcceptedVersion(payload.latestAcceptedVersion);
    // Why: older join rows can contain null measurements if source rows were deleted.
    setLinkedMeasurements(
      payload.linkedMeasurements
        .map((row) => row.measurements)
        .filter((row): row is MeasurementRow => row != null)
    );

    return payload;
  }, [projectId, billId]);

  const loadVersionDetail = useCallback(
    async (versionId: string): Promise<VersionDetailResponse | null> => {
      const response = await fetch(
        `/api/projects/${projectId}/bills/${billId}/versions/${versionId}`
      );
      const json: ApiResponse<VersionDetailResponse> = await response.json();
      if (!response.ok || !json.success || !json.data) {
        return null;
      }
      return json.data;
    },
    [projectId, billId]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await loadBill();
      const [gDetail, aDetail] = await Promise.all([
        payload.latestGeneratedVersion
          ? loadVersionDetail(payload.latestGeneratedVersion.id)
          : Promise.resolve(null),
        payload.latestAcceptedVersion
          ? loadVersionDetail(payload.latestAcceptedVersion.id)
          : Promise.resolve(null),
      ]);
      setGeneratedDetail(gDetail);
      setAcceptedDetail(aDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }, [loadBill, loadVersionDetail]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const measurementCount = linkedMeasurements.length;
  const totalMeasuredQty = useMemo(
    () => linkedMeasurements.reduce((sum, m) => sum + Number(m.quantity || 0), 0),
    [linkedMeasurements]
  );

  const activeVersion = activeTab === "generated" ? generatedVersion : acceptedVersion;
  const activeVersionDetail = activeTab === "generated" ? generatedDetail : acceptedDetail;

  const handleUploadExcel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setActionError(null);
    setActionSuccess(null);
    // Why: capture the tab at submission time so the post-upload state switch is
    // consistent even if the user navigates away before the request completes.
    const targetVersionType = activeTab;
    try {
      const formData = new FormData();
      // Why: upload route expects multipart form-data with optional tax/notes metadata.
      formData.append("file", uploadFile);
      formData.append("taxRate", uploadTaxRate);
      if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());
      // Why: tells the backend which version_type to create so the upload lands in
      // the bucket the user is currently viewing (generated vs accepted).
      formData.append("versionType", targetVersionType);

      const response = await fetch(`/api/projects/${projectId}/bills/${billId}/upload`, {
        method: "POST",
        body: formData,
      });
      const json: ApiResponse<{ version: BillVersion }> = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Failed to upload Excel");
      }

      setUploadFile(null);
      setUploadNotes("");
      await loadAll();
      // Why: stay on the tab the user uploaded to so they see the result immediately.
      setActiveTab(targetVersionType);
      setActionSuccess(
        `Excel uploaded successfully as ${targetVersionType === "accepted" ? "Accepted" : "Generated"} Version.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload Excel");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAcceptBill = async () => {
    if (!generatedVersion) return;
    setIsAccepting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/bills/${billId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceVersionId: generatedVersion.id,
          notes: "Accepted from admin bill detail page",
        }),
      });
      const json: ApiResponse<{ version: BillVersion }> = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Failed to accept bill");
      }
      await loadAll();
      setActiveTab("accepted");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to accept bill");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleExportVersion = async (version: BillVersion) => {
    setIsExporting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const exportResponse = await fetch(
        `/api/projects/${projectId}/bills/${billId}/versions/${version.id}/export`,
        { method: "POST" }
      );
      const exportJson: ApiResponse<ExportVersionResponse> = await exportResponse.json();
      if (!exportResponse.ok || !exportJson.success || !exportJson.data) {
        throw new Error(exportJson.error ?? "Failed to generate export");
      }
      // Why: narrow once so async callbacks can safely reuse a stable, non-null filename.
      const exportedFileName = exportJson.data.fileName;

      const downloadResponse = await fetch(exportJson.data.downloadUrl);
      if (!downloadResponse.ok) {
        throw new Error("Failed to download generated export");
      }

      const blob = await downloadResponse.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      // Why: server-provided name keeps exported files traceable to version metadata.
      anchor.download = exportedFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      // Why: instant UI confirmation reduces repeat-clicks while download initializes.
      setActionSuccess(`Export started: ${exportedFileName}`);
      window.setTimeout(() => {
        setActionSuccess((current) =>
          current === `Export started: ${exportedFileName}` ? null : current
        );
      }, 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to export version");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <Link href={`/admin/projects/${projectId}/bills`} className="text-green-600 hover:text-green-700">
              ← Bills
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center text-gray-500">Loading bill…</div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <Link href={`/admin/projects/${projectId}/bills`} className="text-green-600 hover:text-green-700">
              ← Bills
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-red-600 mb-3">{error ?? "Bill not found"}</p>
          <button
            type="button"
            onClick={loadAll}
            className="text-green-600 hover:text-green-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/admin/projects/${projectId}/bills`} className="text-green-600 hover:text-green-700">
            ← Bills
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">{bill.bill_number}</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {actionError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{actionError}</div>
        ) : null}
        {actionSuccess ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {actionSuccess}
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow-sm p-5">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 font-medium">Sequence</dt>
              <dd className="text-gray-900 mt-0.5">#{bill.bill_sequence}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Created</dt>
              <dd className="text-gray-900 mt-0.5">{formatDate(bill.created_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Linked Measurements</dt>
              <dd className="text-gray-900 mt-0.5">{measurementCount}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Total Measured Qty</dt>
              <dd className="text-gray-900 mt-0.5">{formatQty(totalMeasuredQty)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
              <button
                type="button"
                onClick={() => setActiveTab("generated")}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  activeTab === "generated" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                Generated Version
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("accepted")}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  activeTab === "accepted" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                Accepted Version
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAcceptBill}
                disabled={!generatedVersion || isAccepting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {isAccepting ? "Accepting..." : "Accept Bill"}
              </button>
            </div>
          </div>

          <VersionCard
            title={activeTab === "generated" ? "Generated Version" : "Accepted Version"}
            version={activeVersion}
            details={activeVersionDetail}
            onExport={activeVersion ? () => handleExportVersion(activeVersion) : null}
            isExporting={isExporting}
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5">
          {/* Why: title reflects the active tab so users know exactly which version bucket
              their upload will land in before they submit. */}
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Upload Excel ({activeTab === "accepted" ? "Accepted" : "Generated"} Version)
          </h2>
          <form onSubmit={handleUploadExcel} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                value={uploadTaxRate}
                onChange={(e) => setUploadTaxRate(e.target.value)}
                placeholder="Tax rate"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!uploadFile || isUploading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              {isUploading ? "Uploading..." : "Upload Excel"}
            </button>
            <div className="md:col-span-4">
              <textarea
                rows={2}
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Linked Measurements</h2>
          <div className="overflow-x-auto border border-gray-100 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Area</th>
                  <th className="px-3 py-2 text-left font-medium">BOQ Item</th>
                  <th className="px-3 py-2 text-right font-medium">NOS</th>
                  <th className="px-3 py-2 text-right font-medium">L</th>
                  <th className="px-3 py-2 text-right font-medium">B</th>
                  <th className="px-3 py-2 text-right font-medium">D</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-left font-medium">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linkedMeasurements.map((m) => (
                  <tr key={m.id} className={m.is_deduction ? "bg-red-50/40" : ""}>
                    <td className="px-3 py-2">{formatDate(m.measurement_date)}</td>
                    <td className="px-3 py-2">{m.area_name}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate" title={m.boq_item_id}>
                      {m.boq_item_id}
                    </td>
                    <td className="px-3 py-2 text-right">{formatQty(m.nos)}</td>
                    <td className="px-3 py-2 text-right">{formatQty(m.length)}</td>
                    <td className="px-3 py-2 text-right">{formatQty(m.breadth)}</td>
                    <td className="px-3 py-2 text-right">{formatQty(m.depth)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatQty(m.quantity)}</td>
                    <td className="px-3 py-2">{m.unit}</td>
                  </tr>
                ))}
                {linkedMeasurements.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                      No linked measurements found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
