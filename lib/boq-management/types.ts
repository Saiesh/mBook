/**
 * BOQ (Bill of Quantities) Management Module — Type Definitions
 *
 * Covers BOQ versioning, sections, items, and area mappings.
 * Follows the same DTO / domain-entity split used in project-management.
 */

// -----------------------------------------------------------------------------
// BOQ Version — each Excel upload creates a new immutable version
// -----------------------------------------------------------------------------

export interface BOQVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  fileName: string;
  uploadedBy: string | null;
  isActive: boolean;
  totalAmount: number | null;
  itemCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBOQVersionDTO {
  projectId: string;
  fileName: string;
  uploadedBy?: string;
  totalAmount?: number;
  itemCount?: number;
  notes?: string;
}

// -----------------------------------------------------------------------------
// BOQ Section — logical grouping within a version (e.g. "Hardscape")
// -----------------------------------------------------------------------------

export interface BOQSection {
  id: string;
  boqVersionId: string;
  sectionNumber: number;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface CreateBOQSectionDTO {
  boqVersionId: string;
  sectionNumber: number;
  name: string;
  sortOrder?: number;
}

// -----------------------------------------------------------------------------
// BOQ Item — individual line item imported from Excel
// -----------------------------------------------------------------------------

export interface BOQItem {
  id: string;
  boqVersionId: string;
  boqSectionId: string | null;
  itemNumber: number;
  description: string;
  sapCode: string | null;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder: number;
  createdAt: string;
}

export interface CreateBOQItemDTO {
  boqVersionId: string;
  boqSectionId?: string;
  itemNumber: number;
  description: string;
  sapCode?: string;
  unit?: string;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder?: number;
}

// -----------------------------------------------------------------------------
// BOQ Item ↔ Area Mapping — mutable many-to-many relationship
// -----------------------------------------------------------------------------

export interface BOQItemAreaMapping {
  id: string;
  boqItemId: string;
  areaId: string;
  createdAt: string;
}

export interface CreateBOQItemAreaMappingDTO {
  boqItemId: string;
  areaId: string;
}

// -----------------------------------------------------------------------------
// Aggregated views returned by the API
// -----------------------------------------------------------------------------

/** Version with its nested sections and items */
export interface BOQVersionDetail extends BOQVersion {
  sections: BOQSectionWithItems[];
}

/** Section with its child items */
export interface BOQSectionWithItems extends BOQSection {
  items: BOQItem[];
}

/** Item enriched with the area IDs it's mapped to */
export interface BOQItemWithMappings extends BOQItem {
  areaIds: string[];
}

// -----------------------------------------------------------------------------
// Import result — returned after an Excel upload
// -----------------------------------------------------------------------------

export interface BOQImportResult {
  version: BOQVersion;
  sectionsImported: number;
  itemsImported: number;
  totalAmount: number;
}

// -----------------------------------------------------------------------------
// Atomic import payloads
// -----------------------------------------------------------------------------

export interface AtomicBOQSectionImportDTO {
  sectionNumber: number;
  name: string;
  sortOrder: number;
}

export interface AtomicBOQItemImportDTO {
  sectionSortOrder?: number;
  itemNumber: number;
  description: string;
  sapCode?: string;
  unit?: string;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder: number;
}

export interface AtomicBOQImportDTO {
  projectId: string;
  fileName: string;
  uploadedBy?: string;
  totalAmount: number;
  sections: AtomicBOQSectionImportDTO[];
  items: AtomicBOQItemImportDTO[];
}
