"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface BillVersion {
  id: string;
  version_type: "generated" | "accepted";
  version_number: number;
  source: string;
  grand_total: number | null;
  created_at: string;
}

interface BillRow {
  id: string;
  bill_number: string;
  bill_sequence: number;
  created_at: string;
  latestGeneratedVersion: BillVersion | null;
  latestAcceptedVersion: BillVersion | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

export default function BillsListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BillRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const json = await res.json();
      if (json.success && json.data?.name) setProjectName(json.data.name);
    } catch {
      /* non-critical */
    }
  }, [projectId]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bills`);
      const json: ApiResponse<BillRow[]> = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load bills");
      setBills(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchBills();
  }, [fetchProject, fetchBills]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/bills/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to delete bill");
        return;
      }
      setDeleteTarget(null);
      fetchBills();
    } catch {
      setError("Failed to delete bill");
    } finally {
      setIsDeleting(false);
    }
  };

  const billStats = useMemo(() => {
    // Why: quick counters help admins audit acceptance progress without opening each bill.
    const accepted = bills.filter((bill) => bill.latestAcceptedVersion).length;
    const generatedOnly = bills.filter((bill) => bill.latestGeneratedVersion && !bill.latestAcceptedVersion).length;
    return { accepted, generatedOnly };
  }, [bills]);

  const backHref = `/admin/projects/${projectId}/details`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={backHref} className="text-green-600 hover:text-green-700">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">
            RA Bills
            {projectName && (
              <span className="font-normal text-gray-500 ml-2">– {projectName}</span>
            )}
          </h1>
          <Link
            href={`/admin/projects/${projectId}/measurements`}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Generate From Measurements
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Bills</p>
            <p className="text-2xl font-semibold text-gray-900">{bills.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-500">Accepted Version Available</p>
            <p className="text-2xl font-semibold text-gray-900">{billStats.accepted}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-500">Generated Only</p>
            <p className="text-2xl font-semibold text-gray-900">{billStats.generatedOnly}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent mb-2" />
              <p>Loading bills...</p>
            </div>
          ) : bills.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4 text-gray-300">📄</div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">No RA Bills yet</h2>
              <p className="text-gray-500 mb-6">
                Generate a bill from selected measurements to start bill tracking.
              </p>
              <Link
                href={`/admin/projects/${projectId}/measurements`}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                Open Measurements
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium w-12">#</th>
                  <th className="px-4 py-3 font-medium">Bill Number</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Generated Version</th>
                  <th className="px-4 py-3 font-medium">Accepted Version</th>
                  <th className="px-4 py-3 font-medium w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/projects/${projectId}/bills/${bill.id}`)}
                  >
                    <td className="px-4 py-3 text-gray-500">{bill.bill_sequence}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{bill.bill_number}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(bill.created_at)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {bill.latestGeneratedVersion ? (
                        <div>
                          <p className="font-medium">v{bill.latestGeneratedVersion.version_number}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(bill.latestGeneratedVersion.grand_total)}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {bill.latestAcceptedVersion ? (
                        <div>
                          <p className="font-medium">v{bill.latestAcceptedVersion.version_number}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(bill.latestAcceptedVersion.grand_total)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-1">
                          Not accepted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/admin/projects/${projectId}/bills/${bill.id}`}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 rounded px-2 py-1 text-xs font-medium"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(bill)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-bill-title"
          >
            <h2 id="delete-bill-title" className="text-lg font-semibold text-gray-800 mb-2">
              Delete RA Bill?
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete &quot;{deleteTarget.bill_number}&quot;? This removes all linked bill
              versions.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
