/**
 * Unit tests for AreaRepository
 * Tests flat area management and CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AreaRepository } from '@/lib/project-management/repositories/AreaRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import {
  createTestSupabaseClient,
  createMockProjectDTO,
  createMockAreaDTO,
  TEST_USER_ID,
  cleanupTestProject,
  generateTestCode,
} from '@/tests/utils/test-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Why: remote Supabase + FK-safe `created_by` user are required for integration tests.
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('AreaRepository - Integration Tests', () => {
  let db: SupabaseClient;
  let areaRepository: AreaRepository;
  let projectRepository: ProjectRepository;
  let testProjectId: string;

  beforeEach(async () => {
    db = createTestSupabaseClient();
    areaRepository = new AreaRepository(db);
    projectRepository = new ProjectRepository(db);

    // Create a test project for areas
    const projectDto = createMockProjectDTO({
      name: 'Area Test Project',
      code: generateTestCode('AREA'),
    });
    const project = await projectRepository.create(projectDto, TEST_USER_ID);
    testProjectId = project.id;
  });

  afterEach(async () => {
    // Cleanup will cascade delete areas
    await cleanupTestProject(db, testProjectId);
  });

  describe('create()', () => {
    it('should create an area', async () => {
      const dto = createMockAreaDTO(testProjectId, {
        name: 'Front Yard',
        code: 'FRONT-YARD',
        sortOrder: 1,
      });

      const area = await areaRepository.create(dto);

      expect(area.id).toBeDefined();
      expect(area.name).toBe('Front Yard');
      expect(area.code).toBe('FRONT-YARD');
      expect(area.projectId).toBe(testProjectId);
      expect(area.sortOrder).toBe(1);
    });

    it('should set sort order correctly', async () => {
      const dto1 = createMockAreaDTO(testProjectId, {
        name: 'Area 1',
        code: 'AREA-1',
        sortOrder: 1,
      });
      const dto2 = createMockAreaDTO(testProjectId, {
        name: 'Area 2',
        code: 'AREA-2',
        sortOrder: 2,
      });

      const area1 = await areaRepository.create(dto1);
      const area2 = await areaRepository.create(dto2);

      expect(area1.sortOrder).toBe(1);
      expect(area2.sortOrder).toBe(2);
    });
  });

  describe('findById()', () => {
    it('should find area by ID', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'Find Me', code: 'FIND-ME' });
      const created = await areaRepository.create(dto);

      const found = await areaRepository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const result = await areaRepository.findById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });

    it('should not find soft-deleted areas', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'To Delete', code: 'TO-DELETE' });
      const created = await areaRepository.create(dto);

      await areaRepository.softDelete(created.id);

      const found = await areaRepository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByProjectId()', () => {
    beforeEach(async () => {
      // Create multiple areas
      const area1 = createMockAreaDTO(testProjectId, {
        name: 'Area 1',
        code: 'AREA-1',
        sortOrder: 1,
      });
      const area2 = createMockAreaDTO(testProjectId, {
        name: 'Area 2',
        code: 'AREA-2',
        sortOrder: 2,
      });
      await areaRepository.create(area1);
      await areaRepository.create(area2);
    });

    it('should find all areas for a project', async () => {
      const areas = await areaRepository.findByProjectId(testProjectId);

      expect(areas.length).toBeGreaterThanOrEqual(2);
      expect(areas.every((a) => a.projectId === testProjectId)).toBe(true);
    });

    it('should order by sort order', async () => {
      const areas = await areaRepository.findByProjectId(testProjectId);

      expect(areas.length).toBeGreaterThan(1);
      for (let i = 1; i < areas.length; i++) {
        expect(areas[i].sortOrder >= areas[i - 1].sortOrder).toBe(true);
      }
    });

    it('should not include soft-deleted areas', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'To Delete', code: 'TO-DELETE' });
      const created = await areaRepository.create(dto);

      await areaRepository.softDelete(created.id);

      const areas = await areaRepository.findByProjectId(testProjectId);
      expect(areas.find((a) => a.id === created.id)).toBeUndefined();
    });

    it('should return empty array for project with no areas', async () => {
      // Create a new project
      const emptyProjectDto = createMockProjectDTO({
        code: generateTestCode('EMPTY'),
      });
      const emptyProject = await projectRepository.create(
        emptyProjectDto,
        TEST_USER_ID
      );

      const areas = await areaRepository.findByProjectId(emptyProject.id);
      expect(areas).toEqual([]);

      // Cleanup
      await cleanupTestProject(db, emptyProject.id);
    });
  });

  describe('findByCode()', () => {
    it('should find area by code (case-insensitive)', async () => {
      await areaRepository.create(
        createMockAreaDTO(testProjectId, { code: 'AREA-CODE', name: 'Area Code' })
      );

      const found = await areaRepository.findByCode(testProjectId, 'area-code');
      expect(found).not.toBeNull();
      expect(found?.code).toBe('AREA-CODE');
    });

    it('should return null for missing area code', async () => {
      const found = await areaRepository.findByCode(testProjectId, 'MISSING');
      expect(found).toBeNull();
    });
  });

  describe('update()', () => {
    it('should update area fields', async () => {
      const dto = createMockAreaDTO(testProjectId, {
        name: 'Original Name',
        code: 'ORIGINAL',
      });
      const created = await areaRepository.create(dto);

      const updated = await areaRepository.update(created.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
    });

    it('should update sort order', async () => {
      const dto = createMockAreaDTO(testProjectId, { code: 'ORDER-1', sortOrder: 1 });
      const created = await areaRepository.create(dto);

      const updated = await areaRepository.update(created.id, {
        sortOrder: 5,
      });

      expect(updated.sortOrder).toBe(5);
    });

    it('should throw error for non-existent area', async () => {
      await expect(
        areaRepository.update('00000000-0000-0000-0000-000000000000', {
          name: 'New Name',
        })
      ).rejects.toThrow();
    });
  });

  describe('softDelete()', () => {
    it('should soft delete an area', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'To Delete', code: 'DELETE-ME' });
      const created = await areaRepository.create(dto);

      await areaRepository.softDelete(created.id);

      const found = await areaRepository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should not throw for non-existent area', async () => {
      await expect(
        areaRepository.softDelete('00000000-0000-0000-0000-000000000000')
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error when initialized without client', () => {
      expect(() => new AreaRepository(null as any)).toThrow(
        'AreaRepository requires a Supabase client'
      );
    });
  });
});
