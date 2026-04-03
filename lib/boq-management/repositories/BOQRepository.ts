/**
 * BOQRepository — Supabase implementation of IBOQRepository.
 *
 * Mirrors the AreaRepository pattern: constructor takes a SupabaseClient,
 * private helpers convert between snake_case DB rows and camelCase domain types.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IBOQRepository } from './IBOQRepository';
import type {
  BOQVersion,
  BOQSection,
  BOQItem,
  BOQItemAreaMapping,
  AtomicBOQImportDTO,
  CreateBOQVersionDTO,
  CreateBOQSectionDTO,
  CreateBOQItemDTO,
  CreateBOQItemAreaMappingDTO,
} from '../types';

// ---------------------------------------------------------------------------
// DB row shapes (snake_case)
// ---------------------------------------------------------------------------

/** Why: explicit selects avoid `*` on hot repository paths. */
const BOQ_VERSION_SELECT =
  'id, project_id, version_number, file_name, uploaded_by, is_active, total_amount, item_count, notes, created_at, updated_at';
const BOQ_SECTION_SELECT =
  'id, boq_version_id, section_number, name, sort_order, created_at';
const BOQ_ITEM_SELECT =
  'id, boq_version_id, boq_section_id, item_number, description, sap_code, unit, quantity, rate, amount, sort_order, created_at';
const BOQ_MAPPING_SELECT = 'id, boq_item_id, area_id, created_at';

interface VersionRow {
  id: string;
  project_id: string;
  version_number: number;
  file_name: string;
  uploaded_by: string | null;
  is_active: boolean;
  total_amount: number | null;
  item_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SectionRow {
  id: string;
  boq_version_id: string;
  section_number: number;
  name: string;
  sort_order: number;
  created_at: string;
}

interface ItemRow {
  id: string;
  boq_version_id: string;
  boq_section_id: string | null;
  item_number: number;
  description: string;
  sap_code: string | null;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
}

interface MappingRow {
  id: string;
  boq_item_id: string;
  area_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Row → domain converters
// ---------------------------------------------------------------------------

function rowToVersion(r: VersionRow): BOQVersion {
  return {
    id: r.id,
    projectId: r.project_id,
    versionNumber: r.version_number,
    fileName: r.file_name,
    uploadedBy: r.uploaded_by,
    isActive: r.is_active,
    totalAmount: r.total_amount,
    itemCount: r.item_count,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToSection(r: SectionRow): BOQSection {
  return {
    id: r.id,
    boqVersionId: r.boq_version_id,
    sectionNumber: r.section_number,
    name: r.name,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

function rowToItem(r: ItemRow): BOQItem {
  return {
    id: r.id,
    boqVersionId: r.boq_version_id,
    boqSectionId: r.boq_section_id,
    itemNumber: r.item_number,
    description: r.description,
    sapCode: r.sap_code,
    unit: r.unit,
    quantity: Number(r.quantity),
    rate: Number(r.rate),
    amount: Number(r.amount),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

function rowToMapping(r: MappingRow): BOQItemAreaMapping {
  return {
    id: r.id,
    boqItemId: r.boq_item_id,
    areaId: r.area_id,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class BOQRepository implements IBOQRepository {
  constructor(private readonly db: SupabaseClient) {
    if (!db) {
      throw new Error('BOQRepository requires a Supabase client');
    }
  }

  // =========================================================================
  // Versions
  // =========================================================================

  async createVersion(dto: CreateBOQVersionDTO): Promise<BOQVersion> {
    // Derive the next version number for this project
    const { data: existing, error: countErr } = await this.db
      .from('boq_versions')
      .select('version_number')
      .eq('project_id', dto.projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (countErr) throw new Error(`Failed to read version count: ${countErr.message}`);

    const nextVersion = existing && existing.length > 0
      ? (existing[0] as VersionRow).version_number + 1
      : 1;

    const row = {
      project_id: dto.projectId,
      version_number: nextVersion,
      file_name: dto.fileName,
      uploaded_by: dto.uploadedBy ?? null,
      is_active: true,
      total_amount: dto.totalAmount ?? null,
      item_count: dto.itemCount ?? 0,
      notes: dto.notes ?? null,
    };

    const { data, error } = await this.db
      .from('boq_versions')
      .insert(row)
      .select(BOQ_VERSION_SELECT)
      .single();

    if (error) throw new Error(`Failed to create BOQ version: ${error.message}`);
    return rowToVersion(data as VersionRow);
  }

  async importBOQVersionAtomic(dto: AtomicBOQImportDTO): Promise<BOQVersion> {
    const { data, error } = await this.db.rpc('import_boq_version_atomic', {
      p_project_id: dto.projectId,
      p_file_name: dto.fileName,
      p_uploaded_by: dto.uploadedBy ?? null,
      p_total_amount: dto.totalAmount,
      p_sections: dto.sections.map((section) => ({
        // Why: DB function expects snake_case JSON keys for predictable parsing.
        section_number: section.sectionNumber,
        name: section.name,
        sort_order: section.sortOrder,
      })),
      p_items: dto.items.map((item) => ({
        // Why: section sort order gives a stable in-transaction section lookup key.
        section_sort_order: item.sectionSortOrder ?? null,
        item_number: item.itemNumber,
        description: item.description,
        sap_code: item.sapCode ?? null,
        unit: item.unit ?? null,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        sort_order: item.sortOrder,
      })),
    });

    if (error) throw new Error(`Failed to import BOQ atomically: ${error.message}`);
    return rowToVersion(data as VersionRow);
  }

  async findActiveVersion(projectId: string): Promise<BOQVersion | null> {
    const { data, error } = await this.db
      .from('boq_versions')
      .select(BOQ_VERSION_SELECT)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(`Failed to find active version: ${error.message}`);
    return data ? rowToVersion(data as VersionRow) : null;
  }

  async findVersionsByProjectId(projectId: string): Promise<BOQVersion[]> {
    const { data, error } = await this.db
      .from('boq_versions')
      .select(BOQ_VERSION_SELECT)
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });

    if (error) throw new Error(`Failed to list versions: ${error.message}`);
    return (data ?? []).map((r) => rowToVersion(r as VersionRow));
  }

  async findVersionById(id: string): Promise<BOQVersion | null> {
    const { data, error } = await this.db
      .from('boq_versions')
      .select(BOQ_VERSION_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to find version: ${error.message}`);
    return data ? rowToVersion(data as VersionRow) : null;
  }

  async deactivateAllVersions(projectId: string): Promise<void> {
    const { error } = await this.db
      .from('boq_versions')
      .update({ is_active: false })
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to deactivate versions: ${error.message}`);
  }

  async activateVersion(versionId: string): Promise<void> {
    const { error } = await this.db
      .from('boq_versions')
      .update({ is_active: true })
      .eq('id', versionId);

    if (error) throw new Error(`Failed to activate version: ${error.message}`);
  }

  async deleteVersion(versionId: string): Promise<void> {
    const { error } = await this.db
      .from('boq_versions')
      .delete()
      .eq('id', versionId);

    if (error) throw new Error(`Failed to delete version: ${error.message}`);
  }

  async updateVersionTotals(
    versionId: string,
    totals: { itemCount: number; totalAmount: number }
  ): Promise<void> {
    const { error } = await this.db
      .from('boq_versions')
      .update({ item_count: totals.itemCount, total_amount: totals.totalAmount })
      .eq('id', versionId);

    if (error) throw new Error(`Failed to update version totals: ${error.message}`);
  }

  // =========================================================================
  // Sections
  // =========================================================================

  async createSection(dto: CreateBOQSectionDTO): Promise<BOQSection> {
    const row = {
      boq_version_id: dto.boqVersionId,
      section_number: dto.sectionNumber,
      name: dto.name,
      sort_order: dto.sortOrder ?? 0,
    };

    const { data, error } = await this.db
      .from('boq_sections')
      .insert(row)
      .select(BOQ_SECTION_SELECT)
      .single();

    if (error) throw new Error(`Failed to create section: ${error.message}`);
    return rowToSection(data as SectionRow);
  }

  async findSectionsByVersionId(versionId: string): Promise<BOQSection[]> {
    const { data, error } = await this.db
      .from('boq_sections')
      .select(BOQ_SECTION_SELECT)
      .eq('boq_version_id', versionId)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to list sections: ${error.message}`);
    return (data ?? []).map((r) => rowToSection(r as SectionRow));
  }

  // =========================================================================
  // Items
  // =========================================================================

  async createItem(dto: CreateBOQItemDTO): Promise<BOQItem> {
    const row = {
      boq_version_id: dto.boqVersionId,
      boq_section_id: dto.boqSectionId ?? null,
      item_number: dto.itemNumber,
      description: dto.description,
      sap_code: dto.sapCode ?? null,
      unit: dto.unit ?? null,
      quantity: dto.quantity,
      rate: dto.rate,
      amount: dto.amount,
      sort_order: dto.sortOrder ?? 0,
    };

    const { data, error } = await this.db
      .from('boq_items')
      .insert(row)
      .select(BOQ_ITEM_SELECT)
      .single();

    if (error) throw new Error(`Failed to create item: ${error.message}`);
    return rowToItem(data as ItemRow);
  }

  async createItemsBatch(items: CreateBOQItemDTO[]): Promise<BOQItem[]> {
    if (items.length === 0) return [];

    const rows = items.map((dto) => ({
      boq_version_id: dto.boqVersionId,
      boq_section_id: dto.boqSectionId ?? null,
      item_number: dto.itemNumber,
      description: dto.description,
      sap_code: dto.sapCode ?? null,
      unit: dto.unit ?? null,
      quantity: dto.quantity,
      rate: dto.rate,
      amount: dto.amount,
      sort_order: dto.sortOrder ?? 0,
    }));

    const { data, error } = await this.db
      .from('boq_items')
      .insert(rows)
      .select(BOQ_ITEM_SELECT);

    if (error) throw new Error(`Failed to batch-create items: ${error.message}`);
    return (data ?? []).map((r) => rowToItem(r as ItemRow));
  }

  async findItemsByVersionId(versionId: string): Promise<BOQItem[]> {
    const { data, error } = await this.db
      .from('boq_items')
      .select(BOQ_ITEM_SELECT)
      .eq('boq_version_id', versionId)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to list items: ${error.message}`);
    return (data ?? []).map((r) => rowToItem(r as ItemRow));
  }

  async findItemsBySectionId(sectionId: string): Promise<BOQItem[]> {
    const { data, error } = await this.db
      .from('boq_items')
      .select(BOQ_ITEM_SELECT)
      .eq('boq_section_id', sectionId)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to list items by section: ${error.message}`);
    return (data ?? []).map((r) => rowToItem(r as ItemRow));
  }

  async findItemById(id: string): Promise<BOQItem | null> {
    const { data, error } = await this.db
      .from('boq_items')
      .select(BOQ_ITEM_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to find item: ${error.message}`);
    return data ? rowToItem(data as ItemRow) : null;
  }

  // =========================================================================
  // Area Mappings
  // =========================================================================

  async createMapping(dto: CreateBOQItemAreaMappingDTO): Promise<BOQItemAreaMapping> {
    const row = {
      boq_item_id: dto.boqItemId,
      area_id: dto.areaId,
    };

    const { data, error } = await this.db
      .from('boq_item_area_mappings')
      .insert(row)
      .select(BOQ_MAPPING_SELECT)
      .single();

    if (error) throw new Error(`Failed to create mapping: ${error.message}`);
    return rowToMapping(data as MappingRow);
  }

  async deleteMapping(boqItemId: string, areaId: string): Promise<void> {
    const { error } = await this.db
      .from('boq_item_area_mappings')
      .delete()
      .eq('boq_item_id', boqItemId)
      .eq('area_id', areaId);

    if (error) throw new Error(`Failed to delete mapping: ${error.message}`);
  }

  async findMappingsByItemId(boqItemId: string): Promise<BOQItemAreaMapping[]> {
    const { data, error } = await this.db
      .from('boq_item_area_mappings')
      .select(BOQ_MAPPING_SELECT)
      .eq('boq_item_id', boqItemId);

    if (error) throw new Error(`Failed to list mappings by item: ${error.message}`);
    return (data ?? []).map((r) => rowToMapping(r as MappingRow));
  }

  async findMappingsByAreaId(areaId: string): Promise<BOQItemAreaMapping[]> {
    const { data, error } = await this.db
      .from('boq_item_area_mappings')
      .select(BOQ_MAPPING_SELECT)
      .eq('area_id', areaId);

    if (error) throw new Error(`Failed to list mappings by area: ${error.message}`);
    return (data ?? []).map((r) => rowToMapping(r as MappingRow));
  }
}
