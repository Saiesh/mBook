"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { BOQVersionDetail } from "@/lib/boq-management/types";
import { getAreaNameSuggestions, getPendingMeasurements, savePendingMeasurement } from "@/lib/capture/offline-store";
import { syncProjectMeasurements } from "@/lib/capture/sync";
import { useOnlineAutoSync } from "@/lib/capture/use-online-auto-sync";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ProjectPayload {
  name: string;
}

interface BoqVersionRow {
  id: string;
  isActive: boolean;
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
  remarks: string | null;
  isLocalPending?: boolean;
}

type ProjectDateParams = {
  projectId: string;
  date: string;
};

export interface AddMeasurementFormState {
  areaName: string;
  nos: string;
  length: string;
  breadth: string;
  depth: string;
  unit: string;
  remarks: string;
  isDeduction: boolean;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type AddMeasurementItem = BOQVersionDetail["sections"][number]["items"][number];

export interface ParsedAddMeasurementInput {
  areaName: string;
  unit: string;
  nos: number;
  length: number | null;
  breadth: number | null;
  depth: number | null;
  remarks: string;
  isDeduction: boolean;
}

export function parseAddMeasurementInput(form: AddMeasurementFormState): ParsedAddMeasurementInput {
  if (!form.areaName.trim()) {
    throw new Error("Area name is required");
  }
  if (!form.unit.trim()) {
    throw new Error("Unit is required");
  }

  const nosValue = parseOptionalNumber(form.nos);
  if (nosValue == null || nosValue <= 0) {
    throw new Error("NOS must be a positive number");
  }

  const lengthValue = parseOptionalNumber(form.length);
  const breadthValue = parseOptionalNumber(form.breadth);
  const depthValue = parseOptionalNumber(form.depth);

  if ((form.length.trim() && lengthValue == null) || (form.breadth.trim() && breadthValue == null) || (form.depth.trim() && depthValue == null)) {
    throw new Error("Length, breadth, and depth must be valid numbers");
  }

  return {
    areaName: form.areaName,
    unit: form.unit,
    nos: nosValue,
    length: lengthValue,
    breadth: breadthValue,
    depth: depthValue,
    remarks: form.remarks,
    isDeduction: form.isDeduction,
  };
}

export function buildPendingMeasurementInput(params: {
  projectId: string;
  safeDate: string;
  activeAddItem: AddMeasurementItem;
  form: AddMeasurementFormState;
}) {
  const parsed = parseAddMeasurementInput(params.form);
  return {
    projectId: params.projectId,
    boqItemId: params.activeAddItem.id,
    boqItemLabel: `#${params.activeAddItem.itemNumber} ${params.activeAddItem.description}`,
    areaName: parsed.areaName,
    nos: parsed.nos,
    length: parsed.length,
    breadth: parsed.breadth,
    depth: parsed.depth,
    unit: parsed.unit,
    measurementDate: params.safeDate,
    remarks: parsed.remarks,
    isDeduction: parsed.isDeduction,
  };
}

export default function ProjectDatePage() {
  const params = useParams<ProjectDateParams>();
  const searchParams = useSearchParams();
  const projectId = params.projectId;
  const safeDate = isIsoDate(params.date) ? params.date : todayIsoDate();
  const showLegacyMigrationNotice = searchParams.get("migratedFrom") === "capture";

  const [projectName, setProjectName] = useState<string>("");
  const [boqDetail, setBoqDetail] = useState<BOQVersionDetail | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [activeAddItemId, setActiveAddItemId] = useState<string | null>(null);
  const [savingAddDialog, setSavingAddDialog] = useState(false);
  const [addDialogError, setAddDialogError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddMeasurementFormState>({
    areaName: "",
    nos: "1",
    length: "",
    breadth: "",
    depth: "",
    unit: "Nos",
    remarks: "",
    isDeduction: false,
  });

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingMeasurements(projectId);
      // Why: header status is scoped to this date, so queued rows are filtered by selected measurement day.
      setPendingCount(pending.filter((row) => row.measurementDate === safeDate).length);
    } catch {
      // Why: count reads are non-critical and should not block capture UI if IndexedDB is temporarily unavailable.
      setPendingCount(0);
    }
  }, [projectId, safeDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectPromise = fetch(`/api/projects/${projectId}`);
      const versionsPromise = fetch(`/api/projects/${projectId}/boq`);
      const measurementsPromise = fetch(`/api/projects/${projectId}/measurements?date=${safeDate}`);

      const [projectResponse, versionsResponse, measurementsResponse] = await Promise.all([
        projectPromise,
        versionsPromise,
        measurementsPromise,
      ]);

      const projectJson = (await projectResponse.json()) as ApiResponse<ProjectPayload>;
      if (!projectResponse.ok || !projectJson.success || !projectJson.data) {
        throw new Error(projectJson.error ?? "Failed to load project");
      }
      setProjectName(projectJson.data.name);

      const versionsJson = (await versionsResponse.json()) as ApiResponse<BoqVersionRow[]>;
      if (!versionsResponse.ok || !versionsJson.success || !versionsJson.data) {
        throw new Error(versionsJson.error ?? "Failed to load BOQ versions");
      }

      const activeVersion = versionsJson.data.find((row) => row.isActive);
      if (!activeVersion) {
        throw new Error("No active BOQ version found for this project");
      }

      const boqDetailResponse = await fetch(`/api/projects/${projectId}/boq/${activeVersion.id}`);
      const boqDetailJson = (await boqDetailResponse.json()) as ApiResponse<BOQVersionDetail>;
      if (!boqDetailResponse.ok || !boqDetailJson.success || !boqDetailJson.data) {
        throw new Error(boqDetailJson.error ?? "Failed to load BOQ detail");
      }
      setBoqDetail(boqDetailJson.data);

      const measurementsJson = (await measurementsResponse.json()) as ApiResponse<MeasurementRow[]>;
      if (!measurementsResponse.ok || !measurementsJson.success || !measurementsJson.data) {
        throw new Error(measurementsJson.error ?? "Failed to load measurements");
      }
      setMeasurements(measurementsJson.data);
      await refreshPendingCount();

      // Why: area suggestions improve entry speed for repeated zones while still allowing free-text input.
      const suggestions = await getAreaNameSuggestions(projectId);
      setAreaOptions(suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load capture page");
    } finally {
      setLoading(false);
    }
  }, [projectId, refreshPendingCount, safeDate]);

  useEffect(() => {
    // Why: keeping a single load function avoids inconsistent partial state across project/BOQ/measurement fetches.
    void loadData();
  }, [loadData]);

  const measurementsByItemId = useMemo(() => {
    // Why: BOQ item rows can render quickly with O(1) lookup instead of filtering the full list repeatedly.
    return measurements.reduce<Record<string, MeasurementRow[]>>((acc, row) => {
      if (!acc[row.boq_item_id]) acc[row.boq_item_id] = [];
      acc[row.boq_item_id].push(row);
      return acc;
    }, {});
  }, [measurements]);

  const syncedCount = useMemo(() => {
    // Why: local optimistic rows should be represented in pending, not synced.
    return measurements.filter((row) => !row.isLocalPending).length;
  }, [measurements]);

  const activeAddItem = useMemo(() => {
    if (!boqDetail || !activeAddItemId) return null;
    for (const section of boqDetail.sections) {
      const match = section.items.find((item) => item.id === activeAddItemId);
      if (match) return match;
    }
    return null;
  }, [activeAddItemId, boqDetail]);

  const openAddDialog = useCallback(
    (item: BOQVersionDetail["sections"][number]["items"][number]) => {
      setActiveAddItemId(item.id);
      setAddDialogError(null);
      setMessage(null);
      setAddForm({
        areaName: "",
        nos: "1",
        length: "",
        breadth: "",
        depth: "",
        // Why: defaulting from BOQ unit prevents accidental unit drift across rows.
        unit: item.unit ?? "Nos",
        remarks: "",
        isDeduction: false,
      });
    },
    []
  );

  const closeAddDialog = useCallback(() => {
    setActiveAddItemId(null);
    setAddDialogError(null);
  }, []);

  const handleAddMeasurement = useCallback(async () => {
    if (!activeAddItem) return;

    setSavingAddDialog(true);
    setAddDialogError(null);
    setMessage(null);

    try {
      // Why: shared builder keeps dialog rules and submit payload behavior testable in isolation.
      const payload = buildPendingMeasurementInput({
        projectId,
        safeDate,
        activeAddItem,
        form: addForm,
      });
      const saved = await savePendingMeasurement(payload);

      // Why: optimistic insertion keeps the expanded BOQ panel in sync without waiting for a network roundtrip.
      const optimisticRow: MeasurementRow = {
        id: `pending-${saved.clientId}`,
        boq_item_id: saved.boqItemId,
        area_name: saved.areaName,
        nos: saved.nos,
        length: saved.length,
        breadth: saved.breadth,
        depth: saved.depth,
        quantity: saved.quantity,
        unit: saved.unit,
        remarks: saved.remarks,
        isLocalPending: true,
      };
      setMeasurements((prev) => [optimisticRow, ...prev]);
      await refreshPendingCount();

      const suggestions = await getAreaNameSuggestions(projectId);
      setAreaOptions(suggestions);

      setMessage("Measurement saved locally. Sync when online.");
      closeAddDialog();
    } catch (err) {
      setAddDialogError(err instanceof Error ? err.message : "Failed to add measurement");
    } finally {
      setSavingAddDialog(false);
    }
  }, [activeAddItem, addForm, closeAddDialog, projectId, refreshPendingCount, safeDate]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await syncProjectMeasurements(projectId);
      // Why: reloading ensures server data and local pending counters converge after a sync attempt.
      await loadData();
      setMessage(
        `Synced ${result.synced} measurement(s)${result.duplicates ? `, skipped ${result.duplicates} duplicate(s)` : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync measurements");
    } finally {
      setSyncing(false);
    }
  }, [loadData, projectId]);

  const { runSync: runSyncWithGuard } = useOnlineAutoSync({
    onSync: handleSyncNow,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/measurements/project/${projectId}`}
              className="text-sm font-medium text-green-700 hover:text-green-800"
            >
              ← Project
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">
              {projectName ? `${projectName} · Capture` : "Capture Measurements"}
            </h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{formatDate(safeDate)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                Synced: {syncedCount}
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                Pending: {pendingCount}
              </span>
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void runSyncWithGuard()}
              className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        {showLegacyMigrationNotice ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {/* Why: users coming from deprecated `/capture` URLs need explicit confirmation that this is the replacement flow. */}
            You were redirected from `/capture`; this date view is the new canonical capture route.
          </section>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">{message}</div>
        ) : null}

        {loading ? (
          <section className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            Loading BOQ accordions...
          </section>
        ) : boqDetail == null ? (
          <section className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            BOQ detail is unavailable for this project.
          </section>
        ) : (
          boqDetail.sections.map((section) => (
            <details key={section.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" open>
              <summary className="cursor-pointer list-none border-b border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Section {section.sectionNumber}: {section.name}
                    </p>
                    <p className="text-xs text-gray-500">{section.items.length} BOQ item(s)</p>
                  </div>
                  <span className="text-xs font-medium text-green-700">Tap to toggle</span>
                </div>
              </summary>

              <div className="divide-y divide-gray-100">
                {section.items.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No BOQ items in this section.</div>
                ) : (
                  section.items.map((item) => {
                    const rows = measurementsByItemId[item.id] ?? [];
                    const itemQty = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
                    const itemCost = itemQty * Number(item.rate);

                    return (
                      <details
                        key={item.id}
                        className={
                          rows.length > 0
                            ? // Why: a quiet left accent + wash lets field staff scan which BOQ lines already have capture for this date without opening each accordion.
                              "border-l-[3px] border-l-emerald-200 bg-emerald-50/50 px-4 py-3"
                            : "px-4 py-3"
                        }
                      >
                        <summary className="list-none">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                #{item.itemNumber} {item.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                Rate {formatCurrency(Number(item.rate))} / {item.unit ?? "Nos"} · {rows.length} row(s)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddDialog(item)}
                              className="inline-flex rounded-lg border border-green-600 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                            >
                              + Add
                            </button>
                          </div>
                        </summary>

                        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-xs">
                            <span className="font-medium text-gray-700">
                              Total Qty: {formatNumber(itemQty)} {item.unit ?? ""}
                            </span>
                            <span className="font-medium text-gray-700">Total Cost: {formatCurrency(itemCost)}</span>
                          </div>

                          {rows.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500">
                              No measurements captured for this BOQ item on {formatDate(safeDate)}.
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {rows.map((row) => (
                                <div key={row.id} className="px-3 py-2 text-xs text-gray-700">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-gray-800">Area: {row.area_name}</p>
                                    <div className="flex items-center gap-2">
                                      {row.isLocalPending ? (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                          Pending sync
                                        </span>
                                      ) : null}
                                      <p className="font-medium text-blue-700">
                                        Qty {formatNumber(row.quantity)} {row.unit}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-5">
                                    <p>NOS: {formatNumber(row.nos)}</p>
                                    <p>L: {formatNumber(row.length)}</p>
                                    <p>B: {formatNumber(row.breadth)}</p>
                                    <p>D: {formatNumber(row.depth)}</p>
                                    <p>Cost: {formatCurrency(Number(row.quantity) * Number(item.rate))}</p>
                                  </div>
                                  {row.remarks ? <p className="mt-1 text-gray-500">Remarks: {row.remarks}</p> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </details>
          ))
        )}
      </main>

      {activeAddItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Add Measurement · #{activeAddItem.itemNumber}
                </p>
                <p className="text-xs text-gray-500">{activeAddItem.description}</p>
              </div>
              <button
                type="button"
                onClick={closeAddDialog}
                className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            {addDialogError ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {addDialogError}
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Area Name</label>
                <input
                  value={addForm.areaName}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, areaName: e.target.value }))}
                  list="measurement-area-suggestions"
                  placeholder="e.g. North edge planter"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <datalist id="measurement-area-suggestions">
                  {areaOptions.map((area) => (
                    <option key={area} value={area} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">NOS</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={addForm.nos}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, nos: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">L</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={addForm.length}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, length: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">B</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={addForm.breadth}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, breadth: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">D</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={addForm.depth}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, depth: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Unit</label>
                  <input
                    value={addForm.unit}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, unit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Remarks</label>
                <textarea
                  rows={2}
                  value={addForm.remarks}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={addForm.isDeduction}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, isDeduction: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Is deduction
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAddDialog}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAddDialog}
                onClick={() => void handleAddMeasurement()}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {savingAddDialog ? "Saving..." : "Save Offline"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
