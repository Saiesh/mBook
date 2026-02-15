/**
 * Project Management Module - Type Definitions
 * Aligned with TECHNICAL_DESIGN_PROJECT_MANAGEMENT.md
 */

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  code: string;
  clientName?: string | null;
  location: {
    city?: string | null;
    state?: string | null;
    address?: string | null;
  };
  startDate?: string | null;
  endDate?: string | null;
  status: ProjectStatus;
  description?: string | null;
  budget?: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateProjectDTO {
  name: string;
  code: string;
  clientName?: string;
  location?: {
    city?: string;
    state?: string;
    address?: string;
  };
  startDate?: string;
  endDate?: string;
  description?: string;
  budget?: number;
}

export interface UpdateProjectDTO {
  name?: string;
  clientName?: string;
  location?: {
    city?: string;
    state?: string;
    address?: string;
  };
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  description?: string;
  budget?: number;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  search?: string;
  createdBy?: string;
  startDateFrom?: string;
  startDateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// -----------------------------------------------------------------------------
// Area Types (hierarchical: zone level 1 → area level 2)
// -----------------------------------------------------------------------------

export interface Area {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string | null;
  parentAreaId?: string | null;
  level: 1 | 2;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AreaHierarchy extends Area {
  children: Area[];
}

export interface CreateAreaDTO {
  projectId: string;
  code: string;
  name: string;
  description?: string;
  parentAreaId?: string | null;
  sortOrder?: number;
}

export interface UpdateAreaDTO {
  code?: string;
  name?: string;
  description?: string;
  parentAreaId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

// -----------------------------------------------------------------------------
// Project Team Member Types
// -----------------------------------------------------------------------------

export type TeamMemberRole = 'ho_qs' | 'site_qs' | 'project_incharge';

export interface ProjectTeamMember {
  id: string;
  projectId: string;
  userId: string;
  role: TeamMemberRole;
  assignedAt: string;
  removedAt?: string | null;
  isActive: boolean;
}

export interface AddTeamMemberDTO {
  projectId: string;
  userId: string;
  role: TeamMemberRole;
}

/** Team member with joined user details (for getTeamMembers) */
export interface TeamMemberWithUser {
  id: string;
  projectId: string;
  userId: string;
  role: TeamMemberRole;
  assignedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
  };
}
