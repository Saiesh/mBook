"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import ProjectSelectDialog from "./components/ProjectSelectDialog";

interface RecentPreviewRow {
  id: string;
  areaName: string;
  quantity: number;
  unit: string;
  createdAt: string;
}

interface RecentProjectGroup {
  projectId: string;
  projectName: string;
  projectCode: string;
  count: number;
  preview: RecentPreviewRow[];
}

interface RecentDateGroup {
  date: string;
  projects: RecentProjectGroup[];
}

interface RecentMeasurementsApiResponse {
  success: boolean;
  data?: RecentDateGroup[];
  error?: string;
}

function formatReadableDate(dateString: string): string {
  const value = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(value.getTime())) return dateString;

  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
}

function MeasurementsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [recentGroups, setRecentGroups] = useState<RecentDateGroup[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRecentMeasurements() {
      setIsLoadingRecent(true);
      setRecentError(null);
      try {
        const response = await fetch("/api/measurements/recent?limit=120", {
          cache: "no-store",
        });
        const result: RecentMeasurementsApiResponse = await response.json();

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "Failed to load recent measurements");
        }

        if (!isMounted) return;
        setRecentGroups(result.data);
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error ? error.message : "Failed to load recent measurements";
        setRecentError(message);
        setRecentGroups([]);
      } finally {
        if (isMounted) {
          setIsLoadingRecent(false);
        }
      }
    }

    // Why: landing should always reflect latest sync status after users return from capture flows.
    void fetchRecentMeasurements();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalRecentCount = useMemo(
    () =>
      recentGroups.reduce(
        (total, dateGroup) =>
          total + dateGroup.projects.reduce((projectTotal, project) => projectTotal + project.count, 0),
        0
      ),
    [recentGroups]
  );
  const showLegacyMigrationNotice = searchParams.get("migratedFrom") === "capture";

  // Why: auto-open the project picker when arriving from the home page "New Measurement" link
  useEffect(() => {
    if (searchParams.get("action") === "capture") {
      setIsProjectPickerOpen(true);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-sm font-medium text-green-700 hover:text-green-800">
            ← Home
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Measurements</h1>
          <button
            type="button"
            onClick={() => {
              // Why: project must be selected first so capture is always scoped correctly.
              setIsProjectPickerOpen(true);
            }}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            Capture Measurements
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {showLegacyMigrationNotice ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              {/* Why: redirect messaging reduces confusion for bookmarked users arriving from the retired `/capture` flow. */}
              Legacy `/capture` links now open the new `/measurements` experience.
            </p>
          </section>
        ) : null}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Recent Measurements</h2>
            {!isLoadingRecent && !recentError && totalRecentCount > 0 ? (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                {totalRecentCount} rows
              </span>
            ) : null}
          </div>

          {isLoadingRecent ? (
            <p className="mt-2 text-sm text-gray-500">Loading recent measurements...</p>
          ) : recentError ? (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3">
              <p className="text-sm text-red-700">{recentError}</p>
            </div>
          ) : recentGroups.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No measurements yet. Capture your first measurement to see it here.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {recentGroups.map((dateGroup) => (
                <div key={dateGroup.date} className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatReadableDate(dateGroup.date)}
                    </p>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {dateGroup.projects.map((projectGroup) => (
                      <li key={`${dateGroup.date}-${projectGroup.projectId}`} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {projectGroup.projectName}
                            </p>
                            <p className="text-xs text-gray-500">{projectGroup.projectCode}</p>
                          </div>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {projectGroup.count} rows
                          </span>
                        </div>

                        <ul className="mt-2 space-y-1">
                          {projectGroup.preview.map((row) => (
                            <li
                              key={row.id}
                              className="flex items-center justify-between gap-3 text-xs text-gray-600"
                            >
                              <span className="truncate">{row.areaName}</span>
                              <span className="whitespace-nowrap">
                                {formatQuantity(row.quantity)} {row.unit}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Capture Measurements</h2>
          <p className="mt-2 text-sm text-gray-600">
            {/* Why: state that only the project-scoped flow remains after removing the legacy `/measurements/new` page. */}
            Start from a project before opening a date capture view (the old standalone form was removed).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsProjectPickerOpen(true)}
              className="inline-flex rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Capture Measurements
            </button>
          </div>
        </section>
      </main>

      <ProjectSelectDialog
        isOpen={isProjectPickerOpen}
        onClose={() => setIsProjectPickerOpen(false)}
        onSelectProject={(projectId) => {
          router.push(`/measurements/project/${projectId}`);
        }}
      />
    </div>
  );
}

export default function MeasurementsPage() {
  return (
    // Why: Next.js static prerender requires Suspense when useSearchParams is used in a client page.
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <MeasurementsPageContent />
    </Suspense>
  );
}
