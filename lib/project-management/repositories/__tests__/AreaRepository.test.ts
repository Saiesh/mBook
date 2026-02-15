/**
 * Unit tests for AreaRepository
 * Tests hierarchical area management, zones, and CRUD operations
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

describe('AreaRepository - Integration Tests', () => {
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
    it('should create a zone (level 1)', async () => {
      const dto = createMockAreaDTO(testProjectId, {
        name: 'Front Yard',
        type: 'zone',
        level: 1,
        path: '/',
        parentId: undefined,
      });

      const area = await areaRepository.create(dto, TEST_USER_ID);

      expect(area.id).toBeDefined();
      expect(area.name).toBe('Front Yard');
      expect(area.type).toBe('zone');
      expect(area.level).toBe(1);
      expect(area.path).toBe('/');
      expect(area.parentId).toBeNull();
      expect(area.projectId).toBe(testProjectId);
      expect(area.createdBy).toBe(TEST_USER_ID);
    });

    it('should create a child area under a zone (level 2)', async () => {
      // Create parent zone
      const zoneDto = createMockAreaDTO(testProjectId, {
        name: 'Back Yard',
        type: 'zone',
        level: 1,
        path: '/',
      });
      const zone = await areaRepository.create(zoneDto, TEST_USER_ID);

      // Create child area
      const areaDto = createMockAreaDTO(testProjectId, {
        name: 'Deck',
        type: 'area',
        level: 2,
        parentId: zone.id,
        path: `/${zone.id}`,
      });
      const area = await areaRepository.create(areaDto, TEST_USER_ID);

      expect(area.level).toBe(2);
      expect(area.parentId).toBe(zone.id);
      expect(area.path).toBe(`/${zone.id}`);
    });

    it('should set display order correctly', async () => {
      const dto1 = createMockAreaDTO(testProjectId, {
        name: 'Zone 1',
        displayOrder: 1,
      });
      const dto2 = createMockAreaDTO(testProjectId, {
        name: 'Zone 2',
        displayOrder: 2,
      });

      const area1 = await areaRepository.create(dto1, TEST_USER_ID);
      const area2 = await areaRepository.create(dto2, TEST_USER_ID);

      expect(area1.displayOrder).toBe(1);
      expect(area2.displayOrder).toBe(2);
    });

    it('should create area with custom color', async () => {
      const dto = createMockAreaDTO(testProjectId, {
        name: 'Colored Zone',
        color: '#FF5733',
      });

      const area = await areaRepository.create(dto, TEST_USER_ID);
      expect(area.color).toBe('#FF5733');
    });
  });

  describe('findById()', () => {
    it('should find area by ID', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'Find Me' });
      const created = await areaRepository.create(dto, TEST_USER_ID);

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
      const dto = createMockAreaDTO(testProjectId, { name: 'To Delete' });
      const created = await areaRepository.create(dto, TEST_USER_ID);

      await areaRepository.softDelete(created.id);

      const found = await areaRepository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByProjectId()', () => {
    beforeEach(async () => {
      // Create multiple areas
      const zone1 = createMockAreaDTO(testProjectId, {
        name: 'Zone 1',
        displayOrder: 1,
      });
      const zone2 = createMockAreaDTO(testProjectId, {
        name: 'Zone 2',
        displayOrder: 2,
      });
      await areaRepository.create(zone1, TEST_USER_ID);
      await areaRepository.create(zone2, TEST_USER_ID);
    });

    it('should find all areas for a project', async () => {
      const areas = await areaRepository.findByProjectId(testProjectId);

      expect(areas.length).toBeGreaterThanOrEqual(2);
      expect(areas.every((a) => a.projectId === testProjectId)).toBe(true);
    });

    it('should order by display order', async () => {
      const areas = await areaRepository.findByProjectId(testProjectId);

      expect(areas.length).toBeGreaterThan(1);
      for (let i = 1; i < areas.length; i++) {
        expect(areas[i].displayOrder >= areas[i - 1].displayOrder).toBe(true);
      }
    });

    it('should not include soft-deleted areas', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'To Delete' });
      const created = await areaRepository.create(dto, TEST_USER_ID);

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

  describe('getHierarchy()', () => {
    it('should build hierarchical tree structure', async () => {
      // Create zone
      const zoneDto = createMockAreaDTO(testProjectId, {
        name: 'Main Zone',
        type: 'zone',
        level: 1,
        displayOrder: 1,
      });
      const zone = await areaRepository.create(zoneDto, TEST_USER_ID);

      // Create child areas
      const child1Dto = createMockAreaDTO(testProjectId, {
        name: 'Child Area 1',
        type: 'area',
        level: 2,
        parentId: zone.id,
        path: `/${zone.id}`,
        displayOrder: 1,
      });
      const child2Dto = createMockAreaDTO(testProjectId, {
        name: 'Child Area 2',
        type: 'area',
        level: 2,
        parentId: zone.id,
        path: `/${zone.id}`,
        displayOrder: 2,
      });
      await areaRepository.create(child1Dto, TEST_USER_ID);
      await areaRepository.create(child2Dto, TEST_USER_ID);

      const hierarchy = await areaRepository.getHierarchy(testProjectId);

      expect(hierarchy.length).toBeGreaterThanOrEqual(1);
      const mainZone = hierarchy.find((z) => z.name === 'Main Zone');
      expect(mainZone).toBeDefined();
      expect(mainZone?.children).toBeDefined();
      expect(mainZone?.children?.length).toBe(2);
      expect(mainZone?.children?.[0].name).toBe('Child Area 1');
      expect(mainZone?.children?.[1].name).toBe('Child Area 2');
    });

    it('should handle multiple zones with children', async () => {
      // Create two zones
      const zone1Dto = createMockAreaDTO(testProjectId, {
        name: 'Zone 1',
        displayOrder: 1,
      });
      const zone2Dto = createMockAreaDTO(testProjectId, {
        name: 'Zone 2',
        displayOrder: 2,
      });
      const zone1 = await areaRepository.create(zone1Dto, TEST_USER_ID);
      const zone2 = await areaRepository.create(zone2Dto, TEST_USER_ID);

      // Add children to each zone
      const child1 = createMockAreaDTO(testProjectId, {
        name: 'Zone 1 Child',
        type: 'area',
        level: 2,
        parentId: zone1.id,
        path: `/${zone1.id}`,
      });
      const child2 = createMockAreaDTO(testProjectId, {
        name: 'Zone 2 Child',
        type: 'area',
        level: 2,
        parentId: zone2.id,
        path: `/${zone2.id}`,
      });
      await areaRepository.create(child1, TEST_USER_ID);
      await areaRepository.create(child2, TEST_USER_ID);

      const hierarchy = await areaRepository.getHierarchy(testProjectId);

      expect(hierarchy.length).toBeGreaterThanOrEqual(2);
      const z1 = hierarchy.find((z) => z.name === 'Zone 1');
      const z2 = hierarchy.find((z) => z.name === 'Zone 2');
      expect(z1?.children?.length).toBe(1);
      expect(z2?.children?.length).toBe(1);
    });

    it('should return empty array for project with no areas', async () => {
      const emptyProjectDto = createMockProjectDTO({
        code: generateTestCode('NOAREA'),
      });
      const emptyProject = await projectRepository.create(
        emptyProjectDto,
        TEST_USER_ID
      );

      const hierarchy = await areaRepository.getHierarchy(emptyProject.id);
      expect(hierarchy).toEqual([]);

      await cleanupTestProject(db, emptyProject.id);
    });
  });

  describe('update()', () => {
    it('should update area fields', async () => {
      const dto = createMockAreaDTO(testProjectId, { name: 'Original Name' });
      const created = await areaRepository.create(dto, TEST_USER_ID);

      const updated = await areaRepository.update(created.id, {
        name: 'Updated Name',
        color: '#00FF00',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.color).toBe('#00FF00');
    });

    it('should update display order', async () => {
      const dto = createMockAreaDTO(testProjectId, { displayOrder: 1 });
      const created = await areaRepository.create(dto, TEST_USER_ID);

      const updated = await areaRepository.update(created.id, {
        displayOrder: 5,
      });

      expect(updated.displayOrder).toBe(5);
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
      const dto = createMockAreaDTO(testProjectId, { name: 'To Delete' });
      const created = await areaRepository.create(dto, TEST_USER_ID);

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
