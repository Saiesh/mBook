"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/project-management/types";

interface ProjectSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
}

interface ProjectsApiResponse {
  success: boolean;
  data?: Project[];
  error?: string;
}

export default function ProjectSelectDialog({
  isOpen,
  onClose,
  onSelectProject,
}: ProjectSelectDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    // Why: reduce API chatter while still feeling responsive to typing.
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchProjects() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        params.set("sortBy", "updated_at");
        params.set("sortOrder", "desc");
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const response = await fetch(`/api/projects?${params.toString()}`);
        const result: ProjectsApiResponse = await response.json();

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "Failed to load projects");
        }

        setProjects(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load projects";
        setError(message);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    void fetchProjects();
  }, [isOpen, debouncedSearch]);

  useEffect(() => {
    if (!isOpen) return;

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  const emptyMessage = useMemo(() => {
    if (searchTerm.trim()) {
      return "No projects match your search.";
    }
    return "No projects available.";
  }, [searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close project picker"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-picker-title"
        className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="project-picker-title" className="text-lg font-semibold text-gray-900">
              Select Project
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Choose a project before starting measurement capture.
          </p>
        </div>

        <div className="space-y-3 p-4">
          <input
            type="text"
            placeholder="Search by project name or code..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
          />

          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">Loading projects...</div>
            ) : error ? (
              <div className="p-6 text-center">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">{emptyMessage}</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Why: close immediately so navigation feels snappy on slower devices.
                        onClose();
                        onSelectProject(project.id);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-green-50"
                    >
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-500">{project.code}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
