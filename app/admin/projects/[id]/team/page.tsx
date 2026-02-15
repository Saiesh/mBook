"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  TeamMemberWithUser,
  TeamMemberRole,
} from "@/lib/project-management/types";

const ROLES: { value: TeamMemberRole; label: string }[] = [
  { value: "ho_qs", label: "HO QS" },
  { value: "site_qs", label: "Site QS" },
  { value: "project_incharge", label: "Project Incharge" },
];

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

function RoleBadge({ role }: { role: TeamMemberRole }) {
  const styles = ROLE_BADGE_STYLES[role];
  const label = ROLES.find((r) => r.value === role)?.label ?? role;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

interface UserListItem {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ProjectBasic {
  id: string;
  name: string;
  code: string;
}

export default function TeamManagementPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectBasic | null>(null);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>("site_qs");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [removeConfirm, setRemoveConfirm] = useState<{
    member: TeamMemberWithUser;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const json: ApiResponse<ProjectBasic> = await res.json();
      if (res.ok && json.success && json.data) {
        setProject(json.data);
      }
    } catch {
      setProject(null);
    }
  }, [projectId]);

  const fetchTeam = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`);
      const json: ApiResponse<TeamMemberWithUser[]> = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load team members");
      }

      if (!json.success || !json.data) {
        throw new Error("Invalid response from server");
      }

      setMembers(json.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load team members"
      );
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setAddError(null);
    try {
      const params = new URLSearchParams();
      if (userSearch.trim()) {
        params.set("search", userSearch.trim());
      }
      const res = await fetch(`/api/users?${params}`);
      const json: ApiResponse<UserListItem[]> = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load users");
      }

      if (!json.success || !json.data) {
        setUsers([]);
        return;
      }

      setUsers(json.data);
      if (json.data.length > 0 && !selectedUserId) {
        setSelectedUserId("");
      }
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Failed to load users"
      );
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, fetchUsers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setAddError("Please select a user");
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      });

      const json: ApiResponse<unknown> = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to add team member");
      }

      setSelectedUserId("");
      setSelectedRole("site_qs");
      setUserSearch("");
      fetchTeam();
      fetchUsers();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Failed to add team member"
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeConfirm) return;

    setIsRemoving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: removeConfirm.member.userId,
          role: removeConfirm.member.role,
        }),
      });

      const json: ApiResponse<unknown> = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to remove team member");
      }

      setRemoveConfirm(null);
      fetchTeam();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Failed to remove team member"
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const userAlreadyInTeam = selectedUserId && members.some(
    (m) => m.userId === selectedUserId && m.role === selectedRole
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/admin/projects"
            className="text-green-600 hover:text-green-700"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">
            {project ? `Manage Team — ${project.name} (${project.code})` : "Manage Team"}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Add member form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Add Team Member
          </h2>
          <form onSubmit={handleAddMember} className="space-y-4">
            {addError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
              >
                {addError}
              </div>
            )}

            <div>
              <label
                htmlFor="user-search"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Search users
              </label>
              <input
                type="text"
                id="user-search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Type name or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="user-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                User *
              </label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                disabled={usersLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {usersLoading ? "Loading..." : "Select a user"}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                    {u.phone ? ` · ${u.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </span>
              <div className="flex flex-wrap gap-3">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="inline-flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={selectedRole === r.value}
                      onChange={() => setSelectedRole(r.value)}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isAdding || !selectedUserId || userAlreadyInTeam}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isAdding ? "Adding..." : "Add Member"}
            </button>
            {userAlreadyInTeam && selectedUserId && (
              <p className="text-sm text-amber-600">
                This user is already on the team with this role.
              </p>
            )}
          </form>
        </div>

        {/* Team members table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-800 p-4 border-b border-gray-200">
            Team Members
          </h2>
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent mb-2" />
              <p>Loading team members...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                type="button"
                onClick={fetchTeam}
                className="text-green-600 hover:text-green-700 font-medium"
              >
                Try again
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="mb-4">No team members yet.</p>
              <p className="text-sm">
                Use the form above to add members to this project.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Phone
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Role
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Assigned Date
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {member.user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {member.user.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {member.user.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(member.assignedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveConfirm({ member })
                          }
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Remove confirmation modal */}
      {removeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-dialog-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 id="remove-dialog-title" className="text-lg font-semibold text-gray-800 mb-2">
              Remove Team Member
            </h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove{" "}
              <strong>{removeConfirm.member.user.name}</strong> (
              {removeConfirm.member.user.email}) from this project&apos;s team?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setRemoveConfirm(null)}
                disabled={isRemoving}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveMember}
                disabled={isRemoving}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50"
              >
                {isRemoving ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
