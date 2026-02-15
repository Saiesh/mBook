"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AreaHierarchy, Area } from "@/lib/project-management/types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const CODE_REGEX = /^[A-Z0-9_-]+$/i;

function validateArea(code: string, name: string): { code?: string; name?: string } {
  const errors: { code?: string; name?: string } = {};
  const codeTrimmed = code.trim().toUpperCase();
  const nameTrimmed = name.trim();

  if (!codeTrimmed) {
    errors.code = "Area code is required";
  } else if (!CODE_REGEX.test(codeTrimmed)) {
    errors.code = "Code must contain only letters, numbers, hyphens, and underscores";
  }

  if (!nameTrimmed) {
    errors.name = "Area name is required";
  }

  return errors;
}

export default function AreasManagementPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [hierarchy, setHierarchy] = useState<AreaHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [parentZoneId, setParentZoneId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formErrors, setFormErrors] = useState<{ code?: string; name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAreas = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/areas`);
      const json: ApiResponse<AreaHierarchy[]> = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load areas");
      }

      if (!json.success || !json.data) {
        throw new Error("Invalid response from server");
      }

      setHierarchy(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load areas");
      setHierarchy([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const json = await res.json();
      if (json.success && json.data?.name) {
        setProjectName(json.data.name);
      }
    } catch {
      // Ignore - project name is optional
    }
  }, [projectId]);

  useEffect(() => {
    fetchAreas();
    fetchProject();
  }, [fetchAreas, fetchProject]);

  const openAddZone = () => {
    setEditingArea(null);
    setParentZoneId(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openAddSubArea = (zone: Area) => {
    setEditingArea(null);
    setParentZoneId(zone.id);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEditArea = (area: Area) => {
    setEditingArea(area);
    setParentZoneId(area.parentAreaId ?? null);
    setFormCode(area.code);
    setFormName(area.name);
    setFormDescription(area.description ?? "");
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingArea(null);
    setParentZoneId(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateArea(formCode, formName);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    const code = formCode.trim().toUpperCase();
    const name = formName.trim();
    const description = formDescription.trim() || undefined;

    try {
      if (editingArea) {
        const res = await fetch(
          `/api/projects/${projectId}/areas/${editingArea.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, name, description }),
          }
        );
        const json = await res.json();

        if (!res.ok) {
          setSubmitError(json.error ?? "Failed to update area");
          return;
        }
      } else {
        const body: Record<string, unknown> = {
          code,
          name,
          description: description ?? null,
        };
        if (parentZoneId) {
          body.parentAreaId = parentZoneId;
          const zone = hierarchy.find((z) => z.id === parentZoneId);
          if (zone) {
            body.sortOrder = zone.children.length;
          }
        } else {
          body.sortOrder = hierarchy.length;
        }

        const res = await fetch(`/api/projects/${projectId}/areas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();

        if (!res.ok) {
          setSubmitError(json.error ?? "Failed to create area");
          return;
        }
      }

      closeModal();
      fetchAreas();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (area: Area) => {
    setDeleteTarget(area);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/areas/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Failed to delete area");
        return;
      }

      setDeleteTarget(null);
      fetchAreas();
    } catch {
      setError("Failed to delete area. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveUp = async (area: Area, siblings: Area[], index: number) => {
    if (index <= 0) return;
    const prev = siblings[index - 1];
    const prevOrder = prev.sortOrder;
    const currOrder = area.sortOrder;

    try {
      await fetch(`/api/projects/${projectId}/areas/${area.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: prevOrder }),
      });
      await fetch(`/api/projects/${projectId}/areas/${prev.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: currOrder }),
      });
      fetchAreas();
    } catch {
      setError("Failed to reorder. Please try again.");
    }
  };

  const handleMoveDown = async (area: Area, siblings: Area[], index: number) => {
    if (index >= siblings.length - 1) return;
    const next = siblings[index + 1];
    const nextOrder = next.sortOrder;
    const currOrder = area.sortOrder;

    try {
      await fetch(`/api/projects/${projectId}/areas/${area.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: nextOrder }),
      });
      await fetch(`/api/projects/${projectId}/areas/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: currOrder }),
      });
      fetchAreas();
    } catch {
      setError("Failed to reorder. Please try again.");
    }
  };

  const backHref = `/admin/projects/${projectId}/details`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href={backHref}
            className="text-green-600 hover:text-green-700"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">
            Manage Areas
            {projectName && (
              <span className="font-normal text-gray-500 ml-2">
                – {projectName}
              </span>
            )}
          </h1>
          <button
            type="button"
            onClick={openAddZone}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Zone
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent mb-2" />
              <p>Loading areas...</p>
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">No areas yet.</p>
              <button
                type="button"
                onClick={openAddZone}
                className="text-green-600 hover:text-green-700 font-medium"
              >
                Add your first zone
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {hierarchy.map((zone) => (
                <div key={zone.id} className="border-b border-gray-100 last:border-b-0">
                  {/* Zone row */}
                  <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-amber-500 text-lg" aria-hidden>
                        ■
                      </span>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900">
                          {zone.name}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">
                          [{zone.code}]
                        </span>
                        {zone.description && (
                          <p className="text-sm text-gray-500 truncate mt-0.5">
                            {zone.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() =>
                          handleMoveUp(
                            zone,
                            hierarchy,
                            hierarchy.indexOf(zone)
                          )
                        }
                        disabled={hierarchy.indexOf(zone) === 0}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleMoveDown(
                            zone,
                            hierarchy,
                            hierarchy.indexOf(zone)
                          )
                        }
                        disabled={hierarchy.indexOf(zone) === hierarchy.length - 1}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditArea(zone)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openAddSubArea(zone)}
                        className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                        title="Add sub-area"
                      >
                        + Sub
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(zone)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Sub-areas */}
                  {zone.children.length > 0 && (
                    <div className="bg-gray-50/80 pl-12 pr-4 pb-2">
                      {zone.children.map((subArea, idx) => (
                        <div
                          key={subArea.id}
                          className="flex items-center gap-2 py-2 hover:bg-white/60 rounded group"
                        >
                          <span
                            className="text-gray-400 text-sm"
                            aria-hidden
                          >
                            └─
                          </span>
                          <span className="text-blue-600 text-sm">◆</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-800">{subArea.name}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              [{subArea.code}]
                            </span>
                            {subArea.description && (
                              <p className="text-sm text-gray-500 truncate">
                                {subArea.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() =>
                                handleMoveUp(
                                  subArea,
                                  zone.children,
                                  idx
                                )
                              }
                              disabled={idx === 0}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMoveDown(
                                  subArea,
                                  zone.children,
                                  idx
                                )
                              }
                              disabled={idx === zone.children.length - 1}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditArea(subArea)}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(subArea)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              <h2 id="modal-title" className="text-lg font-semibold text-gray-800">
                {editingArea ? "Edit Area" : parentZoneId ? "Add Sub-area" : "Add Zone"}
              </h2>

              {submitError && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm"
                >
                  {submitError}
                </div>
              )}

              <div>
                <label
                  htmlFor="modal-code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Code *
                </label>
                <input
                  type="text"
                  id="modal-code"
                  value={formCode}
                  onChange={(e) =>
                    setFormCode(e.target.value.toUpperCase())
                  }
                  onBlur={() =>
                    setFormCode((c) => c.trim().toUpperCase())
                  }
                  placeholder="e.g. ZONE-A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  autoComplete="off"
                />
                {formErrors.code && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.code}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="modal-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name *
                </label>
                <input
                  type="text"
                  id="modal-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Area name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="modal-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="modal-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingArea
                      ? "Save"
                      : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title" className="text-lg font-semibold text-gray-800 mb-2">
              Delete Area?
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete &quot;{deleteTarget.name}&quot; [
              {deleteTarget.code}]? This cannot be undone.
            </p>
            {(() => {
              const zoneWithChildren =
                deleteTarget.level === 1
                  ? hierarchy.find((z) => z.id === deleteTarget.id)
                  : null;
              const hasChildren =
                zoneWithChildren && zoneWithChildren.children.length > 0;
              return hasChildren ? (
                <p className="text-amber-600 text-sm mb-4">
                  This zone has sub-areas. Delete sub-areas first.
                </p>
              ) : null;
            })()}
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
                disabled={
                  isDeleting ||
                  (deleteTarget.level === 1 &&
                    (hierarchy.find((z) => z.id === deleteTarget.id)
                      ?.children.length ?? 0) > 0)
                }
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
