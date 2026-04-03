import { NextRequest, NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/api/require-session";
import { recentMeasurementsQuerySchema } from "@/lib/api/schemas/measurement-api";

interface MeasurementRecentRow {
  id: string;
  project_id: string;
  measurement_date: string;
  area_name: string;
  quantity: number;
  unit: string;
  created_at: string;
}

interface ProjectMetaRow {
  id: string;
  name: string;
  code: string;
}

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

export function groupRecentMeasurements(params: {
  rows: MeasurementRecentRow[];
  projectById: Map<string, ProjectMetaRow>;
  previewPerProject: number;
}): RecentDateGroup[] {
  const { rows, projectById, previewPerProject } = params;
  const groupedByDate = new Map<string, Map<string, RecentProjectGroup>>();
  for (const row of rows) {
    const projectMeta = projectById.get(row.project_id);
    const dateKey = row.measurement_date;
    const projectKey = row.project_id;

    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, new Map<string, RecentProjectGroup>());
    }

    const dateBucket = groupedByDate.get(dateKey)!;
    if (!dateBucket.has(projectKey)) {
      dateBucket.set(projectKey, {
        projectId: projectKey,
        // Why: fallback metadata keeps grouped cards renderable even if a project row is soft-deleted.
        projectName: projectMeta?.name ?? "Unknown Project",
        projectCode: projectMeta?.code ?? "N/A",
        count: 0,
        preview: [],
      });
    }

    const projectBucket = dateBucket.get(projectKey)!;
    projectBucket.count += 1;
    if (projectBucket.preview.length < previewPerProject) {
      projectBucket.preview.push({
        id: row.id,
        areaName: row.area_name,
        quantity: row.quantity,
        unit: row.unit,
        createdAt: row.created_at,
      });
    }
  }

  return [...groupedByDate.entries()]
    .sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate))
    .map(([date, projectsMap]) => ({
      date,
      projects: [...projectsMap.values()].sort((left, right) =>
        left.projectName.localeCompare(right.projectName)
      ),
    }));
}

function parseBoundedInt(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export async function GET(request: NextRequest) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const q = recentMeasurementsQuerySchema.safeParse(raw);
    if (!q.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", details: q.error.flatten() },
        { status: 422 }
      );
    }

    const limit = q.data.limit ?? parseBoundedInt(searchParams.get("limit"), 120, 1, 300);
    const previewPerProject =
      q.data.previewPerProject ??
      parseBoundedInt(searchParams.get("previewPerProject"), 3, 1, 8);

    const { data: recentRows, error: recentError } = await session.supabase
      .from("measurements")
      .select(
        "id, project_id, measurement_date, area_name, quantity, unit, created_at"
      )
      .is("deleted_at", null)
      .order("measurement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (recentError) {
      throw new Error(`Failed to fetch recent measurements: ${recentError.message}`);
    }

    const typedRows = (recentRows ?? []) as MeasurementRecentRow[];
    if (typedRows.length === 0) {
      return NextResponse.json({ success: true, data: [] as RecentDateGroup[] });
    }

    const projectIds = [...new Set(typedRows.map((row) => row.project_id))];
    const { data: projects, error: projectError } = await session.supabase
      .from("projects")
      .select("id, name, code")
      .in("id", projectIds)
      .is("deleted_at", null);

    if (projectError) {
      throw new Error(`Failed to fetch project metadata: ${projectError.message}`);
    }

    const projectById = new Map<string, ProjectMetaRow>(
      ((projects ?? []) as ProjectMetaRow[]).map((project) => [project.id, project])
    );

    // Why: helper extraction lets tests validate grouping rules without a full Next request mock.
    const data = groupRecentMeasurements({
      rows: typedRows,
      projectById,
      previewPerProject,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/measurements/recent]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch recent measurements",
      },
      { status: 500 }
    );
  }
}
