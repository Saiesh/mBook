/**
 * BOQ Repository Interface
 * Data-access contract for BOQ versions, sections, items, and area mappings.
 */

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

export interface IBOQRepository {
  // -- Versions ----------------------------------------------------------------
  createVersion(dto: CreateBOQVersionDTO): Promise<BOQVersion>;
  findActiveVersion(projectId: string): Promise<BOQVersion | null>;
  findVersionsByProjectId(projectId: string): Promise<BOQVersion[]>;
  findVersionById(id: string): Promise<BOQVersion | null>;
  /** Deactivate every version for a project (called before activating a new one) */
  deactivateAllVersions(projectId: string): Promise<void>;
  /** Re-activate a specific version (used during import rollback). */
  activateVersion(versionId: string): Promise<void>;
  /** Delete a version and cascade its sections/items (used during rollback). */
  deleteVersion(versionId: string): Promise<void>;

  // -- Sections ----------------------------------------------------------------
  createSection(dto: CreateBOQSectionDTO): Promise<BOQSection>;
  findSectionsByVersionId(versionId: string): Promise<BOQSection[]>;

  // -- Items -------------------------------------------------------------------
  createItem(dto: CreateBOQItemDTO): Promise<BOQItem>;
  createItemsBatch(items: CreateBOQItemDTO[]): Promise<BOQItem[]>;
  findItemsByVersionId(versionId: string): Promise<BOQItem[]>;
  findItemsBySectionId(sectionId: string): Promise<BOQItem[]>;
  findItemById(id: string): Promise<BOQItem | null>;

  // -- Area Mappings -----------------------------------------------------------
  createMapping(dto: CreateBOQItemAreaMappingDTO): Promise<BOQItemAreaMapping>;
  deleteMapping(boqItemId: string, areaId: string): Promise<void>;
  findMappingsByItemId(boqItemId: string): Promise<BOQItemAreaMapping[]>;
  findMappingsByAreaId(areaId: string): Promise<BOQItemAreaMapping[]>;

  // -- Version update (item count / total) ------------------------------------
  updateVersionTotals(
    versionId: string,
    totals: { itemCount: number; totalAmount: number }
  ): Promise<void>;

  /**
   * Persist an entire BOQ import (version + sections + items) in one atomic DB transaction.
   */
  importBOQVersionAtomic(dto: AtomicBOQImportDTO): Promise<BOQVersion>;
}
