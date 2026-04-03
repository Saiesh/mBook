"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { BOQVersionDetail } from "@/lib/boq-management/types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface MeasurementRow {
  id: string;
  boq_item_id: string;
  area_name: string;
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

interface ProjectPayload {
  name: string;
}

interface GenerateBillPayload {
  bill: {
    id: string;
    bill_number: string;
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatQty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

export default function MeasurementsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [boqItemLabelById, setBoqItemLabelById] = useState<Record<string, string>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [boqFilter, setBoqFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Why: align with `/measurements/project/.../date/[date]` — the replacement for legacy `/capture/.../measure` (today’s sheet).
  const todayRouteKey = useMemo(() => new Date().toISOString().split("T")[0], []);

  const loadProject = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}`);
    const json: ApiResponse<ProjectPayload> = await response.json();
    if (!response.ok || !json.success || !json.data) return;
    setProjectName(json.data.name);
  }, [projectId]);

  const loadMeasurements = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/measurements`);
    const json: ApiResponse<MeasurementRow[]> = await response.json();
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.error ?? "Failed to load measurements");
    }
    setMeasurements(json.data);
  }, [projectId]);

  const loadBoqLabels = useCallback(async () => {
    const versionsResponse = await fetch(`/api/projects/${projectId}/boq`);
    const versionsJson: ApiResponse<Array<{ id: string; isActive: boolean }>> =
      await versionsResponse.json();
    if (!versionsResponse.ok || !versionsJson.success || !versionsJson.data) return;

    const activeVersion = versionsJson.data.find((row) => row.isActive);
    if (!activeVersion) return;

    const detailResponse = await fetch(`/api/projects/${projectId}/boq/${activeVersion.id}`);
    const detailJson: ApiResponse<BOQVersionDetail> = await detailResponse.json();
    if (!detailResponse.ok || !detailJson.success || !detailJson.data) return;

    const labels: Record<string, string> = {};
    for (const section of detailJson.data.sections) {
      for (const item of section.items) {
        labels[item.id] = `#${item.itemNumber} ${item.description}`;
      }
    }
    setBoqItemLabelById(labels);
  }, [projectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadProject(), loadMeasurements(), loadBoqLabels()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load measurements");
    } finally {
      setLoading(false);
    }
  }, [loadProject, loadMeasurements, loadBoqLabels]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredMeasurements = useMemo(() => {
    return measurements.filter((row) => {
      const boqLabel = boqItemLabelById[row.boq_item_id] ?? row.boq_item_id;
      const boqMatches =
        boqFilter.trim().length === 0 ||
        boqLabel.toLowerCase().includes(boqFilter.trim().toLowerCase());
      const areaMatches =
        areaFilter.trim().length === 0 ||
        row.area_name.toLowerCase().includes(areaFilter.trim().toLowerCase());
      const fromMatches = !dateFrom || row.measurement_date >= dateFrom;
      const toMatches = !dateTo || row.measurement_date <= dateTo;
      return boqMatches && areaMatches && fromMatches && toMatches;
    });
  }, [measurements, boqItemLabelById, boqFilter, areaFilter, dateFrom, dateTo]);

  const groupedByDate = useMemo(() => {
    const groups = filteredMeasurements.reduce<Record<string, MeasurementRow[]>>((acc, row) => {
      if (!acc[row.measurement_date]) acc[row.measurement_date] = [];
      acc[row.measurement_date].push(row);
      return acc;
    }, {});

    const orderedKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));
    return orderedKeys.map((dateKey) => ({
      dateKey,
      rows: groups[dateKey],
    }));
  }, [filteredMeasurements]);

  useEffect(() => {
    if (groupedByDate.length === 0) return;
    setExpandedDates((prev) => {
      const next = { ...prev };
      // Why: default groups to expanded so users can review rows before selecting.
      for (const group of groupedByDate) {
        if (next[group.dateKey] === undefined) next[group.dateKey] = true;
      }
      return next;
    });
  }, [groupedByDate]);

  const selectedCount = selectedIds.size;
  const totalFiltered = filteredMeasurements.length;
  const totalFilteredQty = useMemo(() => {
    return filteredMeasurements.reduce((sum, row) => sum + Number(row.quantity), 0);
  }, [filteredMeasurements]);

  const toggleMeasurement = (measurementId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(measurementId)) next.delete(measurementId);
      else next.add(measurementId);
      return next;
    });
  };

  const toggleDateGroup = (dateKey: string, rows: MeasurementRow[]) => {
    setSelectedIds((prev) => {
      const allSelected = rows.every((row) => prev.has(row.id));
      const next = new Set(prev);
      // Why: group checkbox should act as select-all / clear-all for that date.
      for (const row of rows) {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  };

  const generateBill = async () => {
    if (selectedIds.size === 0) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/bills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurementIds: Array.from(selectedIds),
        }),
      });
      const json: ApiResponse<GenerateBillPayload> = await response.json();
      if (!response.ok || !json.success || !json.data?.bill?.id) {
        throw new Error(json.error ?? "Failed to generate bill");
      }
      router.push(`/admin/projects/${projectId}/bills/${json.data.bill.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate bill");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearFilters = () => {
    // Why: quick reset mirrors capture UX where operators need fast context switching in the field.
    setBoqFilter("");
    setAreaFilter("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/admin/projects/${projectId}/details`} className="text-sm font-medium text-green-700 hover:text-green-800">
              ← Project
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/measurements/project/${projectId}/date/${todayRouteKey}`}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                + Add Measurement
              </Link>
              <button
                type="button"
                disabled={selectedCount === 0 || isGenerating}
                onClick={generateBill}
                className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
              >
                {isGenerating ? "Generating..." : `Generate Bill (${selectedCount})`}
              </button>
            </div>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-gray-900">
            Measurements {projectName ? <span className="font-normal text-gray-500">· {projectName}</span> : null}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-lg bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">Filtered measurements</p>
            <p className="text-2xl font-semibold text-gray-900">{totalFiltered}</p>
            <p className="text-xs text-gray-500">Qty {formatQty(totalFilteredQty)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Selected for bill</p>
            <p className="text-2xl font-semibold text-gray-900">{selectedCount}</p>
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={boqFilter}
              onChange={(e) => setBoqFilter(e.target.value)}
              placeholder="Filter by BOQ item"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="text"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              placeholder="Filter by area name"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">Loading measurements...</div>
          ) : groupedByDate.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
              No measurements found for the selected filters.
            </div>
          ) : (
            groupedByDate.map((group) => {
              const allSelected = group.rows.every((row) => selectedIds.has(row.id));
              const partiallySelected = !allSelected && group.rows.some((row) => selectedIds.has(row.id));
              const isExpanded = expandedDates[group.dateKey] ?? true;
              const totalQty = group.rows.reduce((sum, row) => sum + Number(row.quantity), 0);

              return (
                <div key={group.dateKey} className="rounded-lg bg-white shadow-sm border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = partiallySelected;
                        }}
                        onChange={() => toggleDateGroup(group.dateKey, group.rows)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{formatDate(group.dateKey)}</p>
                        <p className="text-xs text-gray-500">
                          {group.rows.length} rows · Qty {formatQty(totalQty)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedDates((prev) => ({ ...prev, [group.dateKey]: !isExpanded }));
                      }}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      {isExpanded ? "Hide" : "Show"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="divide-y divide-gray-100">
                      {group.rows.map((row) => (
                        <div
                          key={row.id}
                          className={`px-4 py-3 ${row.is_deduction ? "bg-red-50/40" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleMeasurement(row.id)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-semibold text-gray-900 truncate"
                                  title={boqItemLabelById[row.boq_item_id] ?? row.boq_item_id}
                                >
                                  {boqItemLabelById[row.boq_item_id] ?? row.boq_item_id}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Area: {row.area_name}
                                  {row.is_deduction ? " · Deduction" : ""}
                                </p>
                                {row.remarks ? (
                                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">Remarks: {row.remarks}</p>
                                ) : null}
                              </div>
                            </div>
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 whitespace-nowrap">
                              Qty {formatQty(row.quantity)} {row.unit}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-gray-600">
                            <p>NOS: {formatQty(row.nos)}</p>
                            <p>L: {formatQty(row.length)}</p>
                            <p>B: {formatQty(row.breadth)}</p>
                            <p>D: {formatQty(row.depth)}</p>
                            <p className="font-medium text-gray-700">Date: {formatDate(row.measurement_date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
