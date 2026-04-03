/**
 * AreaRepository - Data access layer for Area entity
 * Implements CRUD operations for flat project areas.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAreaRepository } from './IAreaRepository';
import type {
  Area,
  CreateAreaDTO,
  UpdateAreaDTO,
} from '../types';

/** Why: explicit column list for Supabase reads (no `select('*')`). */
const AREA_TABLE_SELECT =
  'id, project_id, code, name, description, sort_order, is_active, created_at, updated_at, deleted_at';

/** Database row shape (snake_case) */
interface AreaRow {
  id: string;
  project_id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToArea(row: AreaRow): Area {
  return {
    id: row.id,
    projectId: row.project_id,
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function dtoToRow(dto: CreateAreaDTO): Omit<
  AreaRow,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
> {
  return {
    project_id: dto.projectId,
    code: dto.code.toUpperCase(),
    name: dto.name,
    description: dto.description ?? null,
    sort_order: dto.sortOrder ?? 0,
    is_active: true,
  };
}

export class AreaRepository implements IAreaRepository {
  constructor(private readonly db: SupabaseClient) {
    if (!db) {
      throw new Error('AreaRepository requires a Supabase client');
    }
  }

  async create(area: CreateAreaDTO): Promise<Area> {
    const row = dtoToRow(area);
    const { data, error } = await this.db
      .from('areas')
      .insert(row)
      .select(AREA_TABLE_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create area: ${error.message}`);
    }
    return rowToArea(data as AreaRow);
  }

  async findById(id: string): Promise<Area | null> {
    const { data, error } = await this.db
      .from('areas')
      .select(AREA_TABLE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find area: ${error.message}`);
    }
    return data ? rowToArea(data as AreaRow) : null;
  }

  async findByProjectId(projectId: string): Promise<Area[]> {
    const { data, error } = await this.db
      .from('areas')
      .select(AREA_TABLE_SELECT)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to find areas by project: ${error.message}`);
    }
    return (data ?? []).map((row) => rowToArea(row as AreaRow));
  }

  async findByCode(projectId: string, code: string): Promise<Area | null> {
    const normalizedCode = code.toUpperCase();
    const { data, error } = await this.db
      .from('areas')
      .select(AREA_TABLE_SELECT)
      .eq('project_id', projectId)
      .eq('code', normalizedCode)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find area by code: ${error.message}`);
    }
    return data ? rowToArea(data as AreaRow) : null;
  }

  async update(id: string, updates: UpdateAreaDTO): Promise<Area> {
    const updateRow: Record<string, unknown> = {};

    if (updates.code !== undefined) updateRow.code = updates.code.toUpperCase();
    if (updates.name !== undefined) updateRow.name = updates.name;
    if (updates.description !== undefined)
      updateRow.description = updates.description;
    if (updates.sortOrder !== undefined)
      updateRow.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateRow.is_active = updates.isActive;

    if (Object.keys(updateRow).length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error(`Area not found: ${id}`);
      }
      return existing;
    }

    const { data, error } = await this.db
      .from('areas')
      .update(updateRow)
      .eq('id', id)
      .is('deleted_at', null)
      .select(AREA_TABLE_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to update area: ${error.message}`);
    }
    if (!data) {
      throw new Error(`Area not found: ${id}`);
    }
    return rowToArea(data as AreaRow);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from('areas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to soft delete area: ${error.message}`);
    }
  }
}
