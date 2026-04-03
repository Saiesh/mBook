import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectRepository } from "@/lib/project-management/repositories/ProjectRepository";
import { supabaseAdmin } from "@/lib/supabase";

type ProjectMeasurementsPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    migratedFrom?: string;
  }>;
};

function formatDateForRoute(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateLabel(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
  }).format(parsed);
}

export default async function ProjectMeasurementsPage({
  params,
  searchParams,
}: ProjectMeasurementsPageProps) {
  const { projectId } = await params;
  const { migratedFrom } = await searchParams;
  const showLegacyMigrationNotice = migratedFrom === "capture";
  const today = new Date();
  const todayKey = formatDateForRoute(today);

  if (!supabaseAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
            <Link href="/measurements" className="text-sm font-medium text-green-700 hover:text-green-800">
              ← Measurements
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Project Measurements</h1>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700">DB offline</span>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-5">
          <section className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-red-700">Database connection not configured</h2>
            <p className="mt-2 text-sm text-gray-600">
              Add valid Supabase environment variables before opening project measurement history.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const projectRepository = new ProjectRepository(supabaseAdmin);
  const project = await projectRepository.findById(projectId);
  if (!project) {
    notFound();
  }

  const { data, error } = await supabaseAdmin
    .from("measurements")
    .select("measurement_date")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("measurement_date", { ascending: false });

  const dayCountMap = new Map<string, number>();
  // Why: collapse multiple rows per date into one navigable day entry for faster project history scanning.
  for (const row of data ?? []) {
    const measurementDate =
      row && typeof row === "object" && "measurement_date" in row
        ? (row as { measurement_date: string | null }).measurement_date
        : null;
    if (!measurementDate) continue;
    dayCountMap.set(measurementDate, (dayCountMap.get(measurementDate) ?? 0) + 1);
  }

  const daySummaries = Array.from(dayCountMap.entries())
    .map(([dateKey, count]) => ({ dateKey, count }))
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/measurements" className="text-sm font-medium text-green-700 hover:text-green-800">
            ← Measurements
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{project.code}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {showLegacyMigrationNotice ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              {/* Why: this confirms to legacy deep-link users that project capture moved from `/capture` to `/measurements`. */}
              This project moved from the legacy `/capture` flow to `/measurements`.
            </p>
          </section>
        ) : null}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Project ID</p>
          <p className="mt-1 font-mono text-sm text-gray-900">{project.id}</p>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Measurement Days</h2>
          {error ? (
            <p className="mt-2 text-sm text-red-600">Could not load measurement days. Please refresh and try again.</p>
          ) : daySummaries.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              No measurements captured for this project yet. Use Add Measurements to start with today.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200">
              {daySummaries.map((entry) => (
                <li key={entry.dateKey}>
                  <Link
                    href={`/measurements/project/${projectId}/date/${entry.dateKey}`}
                    className="flex items-center justify-between px-3 py-3 hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-900">{formatDateLabel(entry.dateKey)}</span>
                    <span className="text-xs text-gray-500">{entry.count} entries</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href={`/measurements/project/${projectId}/date/${todayKey}`}
          className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Add Measurements
        </Link>
      </main>
    </div>
  );
}
