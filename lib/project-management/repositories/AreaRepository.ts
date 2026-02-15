/**
 * AreaRepository - Data access layer for Area entity
 * Implements CRUD operations and hierarchical queries for parent-child relationships
 * Areas are 2-level: zone (level 1, no parent) → area (level 2, child of zone)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAreaRepository } from './IAreaRepository';
import type {
  Area,
  AreaHierarchy,
  CreateAreaDTO,
  UpdateAreaDTO,
} from '../types';

/** Database row shape (snake_case) */
interface AreaRow {
  id: string;
  project_id: string;
  code: string;
  name: string;
  description: string | null;
  parent_area_id: string | null;
  level: number;
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
    parentAreaId: row.parent_area_id,
    level: row.level === 1 ? 1 : 2,
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
  const level = dto.parentAreaId ? 2 : 1;
  return {
    project_id: dto.projectId,
    code: dto.code.toUpperCase(),
    name: dto.name,
    description: dto.description ?? null,
    parent_area_id: dto.parentAreaId ?? null,
    level,
    sort_order: dto.sortOrder ?? 0,
    is_active: true,
  };
}

/**
 * Build hierarchical tree from flat area list.
 * Roots = level 1 (zones), children = level 2 (areas under zones).
 */
function buildAreaHierarchy(areas: Area[]): AreaHierarchy[] {
  const byId = new Map<string, AreaHierarchy>();
  const roots: AreaHierarchy[] = [];

  for (const area of areas) {
    byId.set(area.id, { ...area, children: [] });
  }

  for (const area of areas) {
    const node = byId.get(area.id)!;
    if (area.parentAreaId) {
      const parent = byId.get(area.parentAreaId);
      if (parent) {
        parent.children.push(area);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Sort roots and children by sort_order
  const sortByOrder = (a: Area, b: Area) => a.sortOrder - b.sortOrder;
  roots.sort(sortByOrder);
  for (const root of roots) {
    root.children.sort(sortByOrder);
  }

  return roots;
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
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create area: ${error.message}`);
    }
    return rowToArea(data as AreaRow);
  }

  async findById(id: string): Promise<Area | null> {
    const { data, error } = await this.db
      .from('areas')
      .select('*')
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
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('level', { ascending: true })
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
      .select('*')
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
    if (updates.parentAreaId !== undefined)
      updateRow.parent_area_id = updates.parentAreaId;
    if (updates.sortOrder !== undefined)
      updateRow.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateRow.is_active = updates.isActive;

    if (updates.parentAreaId !== undefined) {
      updateRow.level = updates.parentAreaId ? 2 : 1;
    }

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
      .select()
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

  async countByParentId(parentId: string): Promise<number> {
    const { count, error } = await this.db
      .from('areas')
      .select('*', { count: 'exact', head: true })
      .eq('parent_area_id', parentId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to count child areas: ${error.message}`);
    }
    return count ?? 0;
  }

  /**
   * Get area hierarchy for a project as a tree.
   * Level 1 (zones) at root, level 2 (areas) as children, ordered by sort_order.
   */
  async getHierarchy(projectId: string): Promise<AreaHierarchy[]> {
    const flat = await this.findByProjectId(projectId);
    return buildAreaHierarchy(flat);
  }
}
