"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  Project,
  ProjectStatus,
  AreaHierarchy,
  TeamMemberWithUser,
  TeamMemberRole,
} from "@/lib/project-management/types";

const STATUS_BADGE_STYLES: Record<ProjectStatus, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  ho_qs: "HO QS",
  site_qs: "Site QS",
  project_incharge: "Project Incharge",
};

const ROLE_BADGE_STYLES: Record<TeamMemberRole, string> = {
  ho_qs: "bg-blue-100 text-blue-800",
  site_qs: "bg-green-100 text-green-800",
  project_incharge: "bg-purple-100 text-purple-800",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const styles = STATUS_BADGE_STYLES[status];
  const label = status.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: TeamMemberRole }) {
  const styles = ROLE_BADGE_STYLES[role];
  const label = ROLE_LABELS[role];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

interface ApiProject {
  success: boolean;
  data?: Project;
  error?: string;
}

interface ApiAreas {
  success: boolean;
  data?: AreaHierarchy[];
  error?: string;
}

interface ApiTeam {
  success: boolean;
  data?: TeamMemberWithUser[];
  error?: string;
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [areas, setAreas] = useState<AreaHierarchy[]>([]);
  const [team, setTeam] = useState<TeamMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const [projectRes, areasRes, teamRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/areas`),
        fetch(`/api/projects/${id}/team`),
      ]);

      const projectJson: ApiProject = await projectRes.json();
      if (!projectRes.ok || !projectJson.success) {
        throw new Error(
          projectJson.error ?? "Failed to load project"
        );
      }
      if (!projectJson.data) {
        throw new Error("Project not found");
      }
      setProject(projectJson.data);

      const areasJson: ApiAreas = await areasRes.json();
      if (areasRes.ok && areasJson.success && areasJson.data) {
        setAreas(areasJson.data);
      } else {
        setAreas([]);
      }

      const teamJson: ApiTeam = await teamRes.json();
      if (teamRes.ok && teamJson.success && teamJson.data) {
        setTeam(teamJson.data);
      } else {
        setTeam([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load project details"
      );
      setProject(null);
      setAreas([]);
      setTeam([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const zonesCount = areas.length;
  const subAreasCount = areas.reduce(
    (sum, zone) => sum + (zone.children?.length ?? 0),
    0
  );

  const teamByRole = team.reduce(
    (acc, member) => {
      acc[member.role] = (acc[member.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<TeamMemberRole, number>
  );

  const locationParts = project?.location
    ? [
        project.location.city,
        project.location.state,
        project.location.address,
      ].filter(Boolean)
    : [];
  const locationString = locationParts.length > 0
    ? locationParts.join(", ")
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/admin/projects" className="text-green-600 hover:text-green-700">
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-gray-800">
              Project Details
            </h1>
            <div className="w-16" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent mb-4" />
          <p className="text-gray-500">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/admin/projects" className="text-green-600 hover:text-green-700">
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-gray-800">
              Project Details
            </h1>
            <div className="w-16" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{error ?? "Project not found"}</p>
          <button
            type="button"
            onClick={fetchData}
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
          <Link href="/admin/projects" className="text-green-600 hover:text-green-700">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800 truncate max-w-[200px] md:max-w-none">
            {project.name}
          </h1>
          <div className="flex gap-2">
            <Link
              href={`/admin/projects/${id}`}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Edit
            </Link>
            <Link
              href={`/admin/projects/${id}/areas`}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Manage Areas
            </Link>
            <Link
              href={`/admin/projects/${id}/team`}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Manage Team
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Project Overview Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-800">
                  {project.name}
                </h2>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Code: {project.code}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Client</dt>
              <dd className="mt-0.5 text-gray-900">
                {project.clientName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="mt-0.5 text-gray-900">
                {locationString ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-0.5 text-gray-900">
                {formatDate(project.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">End Date</dt>
              <dd className="mt-0.5 text-gray-900">
                {formatDate(project.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Budget</dt>
              <dd className="mt-0.5 text-gray-900">
                {formatCurrency(project.budget)}
              </dd>
            </div>
          </dl>

          {project.description && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-gray-900 whitespace-pre-wrap">
                {project.description}
              </dd>
            </div>
          )}
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Team Summary</h3>
              <Link
                href={`/admin/projects/${id}/team`}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Manage →
              </Link>
            </div>
            <div className="space-y-2">
              {team.length === 0 ? (
                <p className="text-sm text-gray-500">No team members assigned</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900">
                    {team.length} member{team.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(teamByRole) as [TeamMemberRole, number][]).map(
                      ([role, count]) => (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1 text-sm"
                        >
                          <RoleBadge role={role} />
                          <span className="text-gray-600">×{count}</span>
                        </span>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Areas Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Areas Summary</h3>
              <Link
                href={`/admin/projects/${id}/areas`}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Manage →
              </Link>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-gray-900">
                {zonesCount} zone{zonesCount !== 1 ? "s" : ""},{" "}
                {subAreasCount} sub-area{subAreasCount !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-gray-500">
                Zones are top-level divisions; sub-areas belong to zones.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
