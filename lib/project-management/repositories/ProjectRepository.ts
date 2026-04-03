/**
 * ProjectRepository - Data access layer for Project entity
 * Implements CRUD operations, pagination, and filtering via Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProjectRepository } from './IProjectRepository';
import type {
  Project,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectFilters,
  PaginatedResult,
} from '../types';

/**
 * Explicit column list for `projects` reads/writes.
 * Why: avoids `select('*')` over-fetching per AGENTS.md; shared with team repository.
 */
export const PROJECT_TABLE_SELECT =
  'id, name, code, client_name, location_city, location_state, location_address, start_date, end_date, status, description, budget, created_by, created_at, updated_at, deleted_at';

/** Database row shape (snake_case) */
interface ProjectRow {
  id: string;
  name: string;
  code: string;
  client_name: string | null;
  location_city: string | null;
  location_state: string | null;
  location_address: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  description: string | null;
  budget: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    clientName: row.client_name,
    location: {
      city: row.location_city,
      state: row.location_state,
      address: row.location_address,
    },
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Project['status'],
    description: row.description,
    budget: row.budget != null ? Number(row.budget) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function dtoToRow(
  dto: CreateProjectDTO,
  createdBy: string
): Omit<ProjectRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> {
  return {
    name: dto.name,
    code: dto.code.toUpperCase(),
    client_name: dto.clientName ?? null,
    location_city: dto.location?.city ?? null,
    location_state: dto.location?.state ?? null,
    location_address: dto.location?.address ?? null,
    start_date: dto.startDate ?? null,
    end_date: dto.endDate ?? null,
    status: 'active',
    description: dto.description ?? null,
    budget: dto.budget ?? null,
    created_by: createdBy,
  };
}

export class ProjectRepository implements IProjectRepository {
  constructor(private readonly db: SupabaseClient) {
    if (!db) {
      throw new Error('ProjectRepository requires a Supabase client');
    }
  }

  async create(project: CreateProjectDTO, createdBy: string): Promise<Project> {
    const row = dtoToRow(project, createdBy);
    const { data, error } = await this.db
      .from('projects')
      .insert(row)
      .select(PROJECT_TABLE_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
    return rowToProject(data as ProjectRow);
  }

  async findById(id: string): Promise<Project | null> {
    const { data, error } = await this.db
      .from('projects')
      .select(PROJECT_TABLE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find project: ${error.message}`);
    }
    return data ? rowToProject(data as ProjectRow) : null;
  }

  async findByCode(code: string): Promise<Project | null> {
    const normalizedCode = code.toUpperCase();
    const { data, error } = await this.db
      .from('projects')
      .select(PROJECT_TABLE_SELECT)
      .eq('code', normalizedCode)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find project by code: ${error.message}`);
    }
    return data ? rowToProject(data as ProjectRow) : null;
  }

  async findAll(filters: ProjectFilters = {}): Promise<PaginatedResult<Project>> {
    const page = Math.max(1, filters.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));
    const offset = (page - 1) * limit;
    const sortBy = filters.sortBy ?? 'created_at';
    const sortOrder = filters.sortOrder ?? 'desc';

    let query = this.db
      .from('projects')
      .select(PROJECT_TABLE_SELECT, { count: 'exact' })
      .is('deleted_at', null);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }
    if (filters.startDateFrom) {
      query = query.gte('start_date', filters.startDateFrom);
    }
    if (filters.startDateTo) {
      query = query.lte('start_date', filters.startDateTo);
    }
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${term},code.ilike.${term}`);
    }

    query = query.order(sortBy, {
      ascending: sortOrder === 'asc',
      nullsFirst: false,
    });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: (data ?? []).map((row) => rowToProject(row as ProjectRow)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async update(id: string, updates: UpdateProjectDTO): Promise<Project> {
    const updateRow: Record<string, unknown> = {};

    if (updates.name !== undefined) updateRow.name = updates.name;
    if (updates.clientName !== undefined) updateRow.client_name = updates.clientName;
    if (updates.location !== undefined) {
      if (updates.location.city !== undefined)
        updateRow.location_city = updates.location.city;
      if (updates.location.state !== undefined)
        updateRow.location_state = updates.location.state;
      if (updates.location.address !== undefined)
        updateRow.location_address = updates.location.address;
    }
    if (updates.startDate !== undefined) updateRow.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateRow.end_date = updates.endDate;
    if (updates.status !== undefined) updateRow.status = updates.status;
    if (updates.description !== undefined)
      updateRow.description = updates.description;
    if (updates.budget !== undefined) updateRow.budget = updates.budget;

    if (Object.keys(updateRow).length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error(`Project not found: ${id}`);
      }
      return existing;
    }

    const { data, error } = await this.db
      .from('projects')
      .update(updateRow)
      .eq('id', id)
      .is('deleted_at', null)
      .select(PROJECT_TABLE_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
    if (!data) {
      throw new Error(`Project not found: ${id}`);
    }
    return rowToProject(data as ProjectRow);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to soft delete project: ${error.message}`);
    }
  }

  async exists(code: string, excludeId?: string): Promise<boolean> {
    const normalizedCode = code.toUpperCase();
    let query = this.db
      .from('projects')
      .select('id')
      .eq('code', normalizedCode)
      .is('deleted_at', null)
      .limit(1);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to check project existence: ${error.message}`);
    }
    return (data?.length ?? 0) > 0;
  }
}
