import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { BOQImportService } from '@/lib/boq-management/services/BOQImportService';
import type { IBOQRepository } from '@/lib/boq-management/repositories/IBOQRepository';
import type {
  AtomicBOQImportDTO,
  BOQItem,
  BOQItemAreaMapping,
  BOQSection,
  BOQVersion,
  CreateBOQItemAreaMappingDTO,
  CreateBOQItemDTO,
  CreateBOQSectionDTO,
  CreateBOQVersionDTO,
} from '@/lib/boq-management/types';

class InMemoryBOQRepository implements IBOQRepository {
  public atomicImportCalls = 0;
  public lastAtomicPayload: AtomicBOQImportDTO | null = null;
  public nonAtomicMethodCalled = false;

  private versionCounter = 1;
  private versions: BOQVersion[] = [];

  async importBOQVersionAtomic(dto: AtomicBOQImportDTO): Promise<BOQVersion> {
    this.atomicImportCalls += 1;
    this.lastAtomicPayload = dto;

    const version: BOQVersion = {
      id: `ver-${this.versionCounter++}`,
      projectId: dto.projectId,
      versionNumber: this.versions.length + 1,
      fileName: dto.fileName,
      uploadedBy: dto.uploadedBy ?? null,
      isActive: true,
      totalAmount: dto.totalAmount,
      itemCount: dto.items.length,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.versions = this.versions.map((v) => ({ ...v, isActive: false }));
    this.versions.push(version);
    return version;
  }

  async createVersion(_dto: CreateBOQVersionDTO): Promise<BOQVersion> {
    this.nonAtomicMethodCalled = true;
    throw new Error('createVersion should not be called in atomic import flow');
  }

  async findActiveVersion(_projectId: string): Promise<BOQVersion | null> {
    return this.versions.find((v) => v.isActive) ?? null;
  }

  async findVersionsByProjectId(projectId: string): Promise<BOQVersion[]> {
    return this.versions.filter((v) => v.projectId === projectId);
  }

  async findVersionById(id: string): Promise<BOQVersion | null> {
    return this.versions.find((v) => v.id === id) ?? null;
  }

  async deactivateAllVersions(_projectId: string): Promise<void> {
    this.nonAtomicMethodCalled = true;
    throw new Error('deactivateAllVersions should not be called in atomic import flow');
  }

  async activateVersion(_versionId: string): Promise<void> {
    this.nonAtomicMethodCalled = true;
    throw new Error('activateVersion should not be called in atomic import flow');
  }

  async deleteVersion(_versionId: string): Promise<void> {
    this.nonAtomicMethodCalled = true;
    throw new Error('deleteVersion should not be called in atomic import flow');
  }

  async createSection(_dto: CreateBOQSectionDTO): Promise<BOQSection> {
    this.nonAtomicMethodCalled = true;
    throw new Error('createSection should not be called in atomic import flow');
  }

  async findSectionsByVersionId(_versionId: string): Promise<BOQSection[]> {
    return [];
  }

  async createItem(_dto: CreateBOQItemDTO): Promise<BOQItem> {
    this.nonAtomicMethodCalled = true;
    throw new Error('createItem should not be called in atomic import flow');
  }

  async createItemsBatch(_items: CreateBOQItemDTO[]): Promise<BOQItem[]> {
    this.nonAtomicMethodCalled = true;
    throw new Error('createItemsBatch should not be called in atomic import flow');
  }

  async findItemsByVersionId(_versionId: string): Promise<BOQItem[]> {
    return [];
  }

  async findItemsBySectionId(_sectionId: string): Promise<BOQItem[]> {
    return [];
  }

  async findItemById(_id: string): Promise<BOQItem | null> {
    return null;
  }

  async createMapping(_dto: CreateBOQItemAreaMappingDTO): Promise<BOQItemAreaMapping> {
    throw new Error('Not implemented in test repository');
  }

  async deleteMapping(_boqItemId: string, _areaId: string): Promise<void> {
    throw new Error('Not implemented in test repository');
  }

  async findMappingsByItemId(_boqItemId: string): Promise<BOQItemAreaMapping[]> {
    return [];
  }

  async findMappingsByAreaId(_areaId: string): Promise<BOQItemAreaMapping[]> {
    return [];
  }

  async updateVersionTotals(
    _versionId: string,
    _totals: { itemCount: number; totalAmount: number }
  ): Promise<void> {
    this.nonAtomicMethodCalled = true;
    throw new Error('updateVersionTotals should not be called in atomic import flow');
  }
}

async function createBOQWorkbookBufferWithDuplicateItem(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Abstract');

  // Why: mirror production parser offsets to validate duplicate handling exactly
  // where the real import reads data (rows 5+).
  worksheet.addRow(['Project Header']);
  worksheet.addRow(['ABSTRACT']);
  worksheet.addRow(['Sr.No', 'Description', 'SAP CODE', 'Unit', 'BOQ Qty', 'Rate', 'Amount']);
  worksheet.addRow(['', '', '', '', '', '', '']);
  worksheet.addRow([1, 'Hardscape', '', '', '', '', '']);
  worksheet.addRow([10, 'Paver block', 'SAP-001', 'sqm', 2, 10, 20]);
  worksheet.addRow([10, 'Paver block duplicate', 'SAP-001', 'sqm', 3, 12, 36]);
  worksheet.addRow([11, 'Kerb stone', 'SAP-002', 'rm', 1, 15, 15]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function createBOQWorkbookBufferWithDuplicateNumbersAcrossSections(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Abstract');

  // Why: mirrors real BOQs where each section can restart item numbering.
  worksheet.addRow(['Project Header']);
  worksheet.addRow(['ABSTRACT']);
  worksheet.addRow(['Sr.No', 'Description', 'SAP CODE', 'Unit', 'BOQ Qty', 'Rate', 'Amount']);
  worksheet.addRow(['', '', '', '', '', '', '']);
  worksheet.addRow([1, 'Section A', '', '', '', '', '']);
  worksheet.addRow([10, 'Section A item', 'SAP-A10', 'sqm', 2, 10, 20]);
  worksheet.addRow([2, 'Section B', '', '', '', '', '']);
  worksheet.addRow([10, 'Section B item', 'SAP-B10', 'sqm', 3, 12, 36]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('BOQImportService', () => {
  it('merges duplicate item numbers and persists one atomic import payload', async () => {
    const repo = new InMemoryBOQRepository();
    const service = new BOQImportService(repo);
    const buffer = await createBOQWorkbookBufferWithDuplicateItem();

    const result = await service.importFromBuffer(
      buffer,
      'project-1',
      'boq.xlsx',
      'tester'
    );

    // Why: duplicate rows should be normalized before DB write so unique keys are never hit.
    expect(repo.atomicImportCalls).toBe(1);
    expect(repo.nonAtomicMethodCalled).toBe(false);
    expect(repo.lastAtomicPayload?.items).toHaveLength(2);

    const mergedItem = repo.lastAtomicPayload?.items.find((item) => item.itemNumber === 10);
    expect(mergedItem).toBeDefined();
    expect(mergedItem?.quantity).toBe(5);
    expect(mergedItem?.amount).toBe(56);

    // Why: totals must reflect normalized rows that are actually persisted.
    expect(result.itemsImported).toBe(2);
    expect(result.totalAmount).toBe(71);
    expect(result.version.itemCount).toBe(2);
    expect(result.version.totalAmount).toBe(71);
  });

  it('keeps same item numbers from different sections as separate items', async () => {
    const repo = new InMemoryBOQRepository();
    const service = new BOQImportService(repo);
    const buffer = await createBOQWorkbookBufferWithDuplicateNumbersAcrossSections();

    await service.importFromBuffer(
      buffer,
      'project-1',
      'boq.xlsx',
      'tester'
    );

    // Why: section-local numbering is valid in BOQ sheets and must not collapse.
    expect(repo.lastAtomicPayload?.sections).toHaveLength(2);
    expect(repo.lastAtomicPayload?.items).toHaveLength(2);
    expect(repo.lastAtomicPayload?.items.map((item) => item.sectionSortOrder)).toEqual([0, 1]);
    expect(repo.lastAtomicPayload?.items.map((item) => item.itemNumber)).toEqual([10, 10]);
  });

  it('fails without partial non-atomic writes when atomic persistence errors', async () => {
    class FailingAtomicBOQRepository extends InMemoryBOQRepository {
      override async importBOQVersionAtomic(_dto: AtomicBOQImportDTO): Promise<BOQVersion> {
        this.atomicImportCalls += 1;
        throw new Error('Failed to import BOQ atomically: simulated transaction failure');
      }
    }

    const repo = new FailingAtomicBOQRepository();
    const service = new BOQImportService(repo);
    const buffer = await createBOQWorkbookBufferWithDuplicateItem();

    await expect(
      service.importFromBuffer(
        buffer,
        'project-1',
        'boq.xlsx',
        'tester'
      )
    ).rejects.toThrow('Failed to import BOQ atomically: simulated transaction failure');

    // Why: confirms the service never falls back to legacy multi-step writes,
    // which would risk partial version/section/item state on failures.
    expect(repo.atomicImportCalls).toBe(1);
    expect(repo.nonAtomicMethodCalled).toBe(false);
  });
});
