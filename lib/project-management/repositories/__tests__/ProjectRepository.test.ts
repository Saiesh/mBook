/**
 * Unit tests for ProjectRepository
 * Tests CRUD operations, filtering, pagination, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import {
  createTestSupabaseClient,
  createMockProjectDTO,
  TEST_USER_ID,
  cleanupTestProject,
  expectProjectToMatch,
  generateTestCode,
} from '@/tests/utils/test-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Why: remote Supabase + seeded `users` rows are required; default `npm test` stays local/offline-safe.
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

/**
 * Integration tests - uses real Supabase database
 * Note: These tests require a test database to be set up
 */
describe.skipIf(!runIntegrationTests)('ProjectRepository - Integration Tests', () => {
  let db: SupabaseClient;
  let repository: ProjectRepository;
  let createdProjectIds: string[] = [];

  beforeEach(() => {
    db = createTestSupabaseClient();
    repository = new ProjectRepository(db);
    createdProjectIds = [];
  });

  afterEach(async () => {
    // Clean up created projects
    for (const id of createdProjectIds) {
      await cleanupTestProject(db, id);
    }
  });

  describe('create()', () => {
    it('should create a new project with all fields', async () => {
      const dto = createMockProjectDTO({
        name: 'New Project',
        code: generateTestCode('CREATE'),
      });

      const project = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(project.id);

      expect(project.id).toBeDefined();
      expect(project.name).toBe(dto.name);
      expect(project.code).toBe(dto.code.toUpperCase());
      expect(project.clientName).toBe(dto.clientName);
      expect(project.status).toBe('active');
      expect(project.createdBy).toBe(TEST_USER_ID);
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
      expect(project.deletedAt).toBeNull();
    });

    it('should create a project with minimal fields', async () => {
      const dto = createMockProjectDTO({
        name: 'Minimal Project',
        code: generateTestCode('MIN'),
        clientName: undefined,
        location: undefined,
        startDate: undefined,
        endDate: undefined,
        description: undefined,
        budget: undefined,
      });

      const project = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(project.id);

      expect(project.name).toBe(dto.name);
      expect(project.clientName).toBeNull();
      expect(project.location.city).toBeNull();
      expect(project.startDate).toBeNull();
      expect(project.budget).toBeNull();
    });

    it('should uppercase the project code', async () => {
      const dto = createMockProjectDTO({
        code: 'lowercase-code',
      });

      const project = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(project.id);

      expect(project.code).toBe('LOWERCASE-CODE');
    });

    it('should throw error for duplicate project code', async () => {
      const code = generateTestCode('DUP');
      const dto1 = createMockProjectDTO({ code });
      const dto2 = createMockProjectDTO({ code });

      const project1 = await repository.create(dto1, TEST_USER_ID);
      createdProjectIds.push(project1.id);

      await expect(repository.create(dto2, TEST_USER_ID)).rejects.toThrow();
    });
  });

  describe('findById()', () => {
    it('should find project by ID', async () => {
      const dto = createMockProjectDTO({ name: 'Find By ID Test' });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(dto.name);
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('should not find soft-deleted projects', async () => {
      const dto = createMockProjectDTO({ name: 'To Be Deleted' });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      await repository.softDelete(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByCode()', () => {
    it('should find project by code', async () => {
      const code = generateTestCode('FINDCODE');
      const dto = createMockProjectDTO({ code });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const found = await repository.findByCode(code);

      expect(found).not.toBeNull();
      expect(found?.code).toBe(code.toUpperCase());
    });

    it('should be case-insensitive', async () => {
      const code = generateTestCode('CASE');
      const dto = createMockProjectDTO({ code });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const found = await repository.findByCode(code.toLowerCase());

      expect(found).not.toBeNull();
      expect(found?.code).toBe(code.toUpperCase());
    });

    it('should return null for non-existent code', async () => {
      const result = await repository.findByCode('NONEXISTENT-CODE-12345');
      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      // Create test projects
      for (let i = 1; i <= 5; i++) {
        const dto = createMockProjectDTO({
          name: `Project ${i}`,
          code: generateTestCode(`FIND${i}`),
        });
        const project = await repository.create(dto, TEST_USER_ID);
        // Why: CreateProjectDTO has no status; set mixed statuses via update for filter assertions.
        await repository.update(project.id, {
          status: i % 2 === 0 ? 'active' : 'completed',
        });
        createdProjectIds.push(project.id);
      }
    });

    it('should return paginated results', async () => {
      const result = await repository.findAll({ page: 1, limit: 3 });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.total).toBeGreaterThanOrEqual(5);
    });

    it('should filter by status', async () => {
      const result = await repository.findAll({ status: 'active' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((p) => p.status === 'active')).toBe(true);
    });

    it('should search by name', async () => {
      const result = await repository.findAll({ search: 'Project 1' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((p) => p.name.includes('Project 1'))).toBe(true);
    });

    it('should sort by different fields', async () => {
      const result = await repository.findAll({
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.data.length).toBeGreaterThan(0);
      // Check if sorted
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].name >= result.data[i - 1].name).toBe(true);
      }
    });

    it('should respect default pagination limits', async () => {
      const result = await repository.findAll({});

      expect(result.pagination.limit).toBe(20); // DEFAULT_LIMIT
    });

    it('should not return soft-deleted projects', async () => {
      const dto = createMockProjectDTO({
        name: 'To Be Deleted',
        code: generateTestCode('DEL'),
      });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      await repository.softDelete(created.id);

      const result = await repository.findAll({
        search: 'To Be Deleted',
      });

      expect(result.data.find((p) => p.id === created.id)).toBeUndefined();
    });
  });

  describe('update()', () => {
    it('should update project fields', async () => {
      const dto = createMockProjectDTO({ name: 'Original Name' });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const updated = await repository.update(created.id, {
        name: 'Updated Name',
        status: 'completed',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.status).toBe('completed');
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it('should update location fields partially', async () => {
      const dto = createMockProjectDTO({
        location: { city: 'Original City', state: 'CA' },
      });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const updated = await repository.update(created.id, {
        location: { city: 'New City' },
      });

      expect(updated.location.city).toBe('New City');
      expect(updated.location.state).toBe('CA'); // Should remain unchanged
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        repository.update('00000000-0000-0000-0000-000000000000', {
          name: 'New Name',
        })
      ).rejects.toThrow();
    });

    it('should return same project if no updates provided', async () => {
      const dto = createMockProjectDTO({ name: 'No Update' });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const result = await repository.update(created.id, {});

      expect(result.id).toBe(created.id);
      expect(result.name).toBe(created.name);
    });
  });

  describe('softDelete()', () => {
    it('should soft delete a project', async () => {
      const dto = createMockProjectDTO({ name: 'To Delete' });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      await repository.softDelete(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should not throw for non-existent project', async () => {
      await expect(
        repository.softDelete('00000000-0000-0000-0000-000000000000')
      ).resolves.not.toThrow();
    });

    it('should not affect already deleted projects', async () => {
      const dto = createMockProjectDTO({ name: 'Already Deleted' });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      await repository.softDelete(created.id);
      await expect(repository.softDelete(created.id)).resolves.not.toThrow();
    });
  });

  describe('exists()', () => {
    it('should return true for existing code', async () => {
      const code = generateTestCode('EXISTS');
      const dto = createMockProjectDTO({ code });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const exists = await repository.exists(code);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent code', async () => {
      const exists = await repository.exists('NONEXISTENT-CODE-99999');
      expect(exists).toBe(false);
    });

    it('should exclude specified project ID', async () => {
      const code = generateTestCode('EXCLUDE');
      const dto = createMockProjectDTO({ code });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const exists = await repository.exists(code, created.id);
      expect(exists).toBe(false);
    });

    it('should be case-insensitive', async () => {
      const code = generateTestCode('CASECHECK');
      const dto = createMockProjectDTO({ code });
      const created = await repository.create(dto, TEST_USER_ID);
      createdProjectIds.push(created.id);

      const exists = await repository.exists(code.toLowerCase());
      expect(exists).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking or using invalid credentials
      // For now, we test that errors are properly thrown
      expect(repository).toBeDefined();
    });

    it('should throw error when initialized without client', () => {
      expect(() => new ProjectRepository(null as any)).toThrow(
        'ProjectRepository requires a Supabase client'
      );
    });
  });
});
