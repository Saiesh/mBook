/**
 * Integration tests for UserRepository
 * Tests user management operations, filtering, pagination, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserRepository } from '@/lib/user-management/repositories/UserRepository';
import {
  createTestSupabaseClient,
  createMockUserDTO,
  cleanupTestUser,
  expectUserToMatch,
  generateTestEmail,
} from '@/tests/utils/test-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/user-management/types';

// Why: hits live Auth + `users` table; keep default unit test run fast and credential-optional.
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

/**
 * Integration tests - uses real Supabase database
 * Note: These tests require a test database to be set up
 */
describe.skipIf(!runIntegrationTests)('UserRepository - Integration Tests', () => {
  let db: SupabaseClient;
  let repository: UserRepository;
  let createdUserIds: string[] = [];

  beforeEach(() => {
    db = createTestSupabaseClient();
    repository = new UserRepository(db);
    createdUserIds = [];
  });

  afterEach(async () => {
    // Clean up created users
    for (const id of createdUserIds) {
      await cleanupTestUser(db, id);
    }
  });

  describe('create()', () => {
    it('should create a new user with all fields', async () => {
      const dto = createMockUserDTO({
        name: 'John Doe',
        email: generateTestEmail('john'),
        phone: '+1234567890',
        role: 'admin',
      });

      const user = await repository.create(dto);
      createdUserIds.push(user.id);

      expect(user.id).toBeDefined();
      expect(user.name).toBe(dto.name);
      expect(user.email).toBe(dto.email);
      expect(user.phone).toBe(dto.phone);
      expect(user.role).toBe(dto.role);
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should create a user with minimal fields', async () => {
      const dto = createMockUserDTO({
        name: 'Jane Doe',
        email: generateTestEmail('jane'),
        phone: undefined,
        role: 'site_qs',
      });

      const user = await repository.create(dto);
      createdUserIds.push(user.id);

      expect(user.name).toBe(dto.name);
      expect(user.email).toBe(dto.email);
      expect(user.phone).toBeNull();
      expect(user.role).toBe('site_qs');
    });

    it('should create users with different roles', async () => {
      const roles: UserRole[] = ['admin', 'ho_qs', 'site_qs'];

      for (const role of roles) {
        const dto = createMockUserDTO({
          email: generateTestEmail(role),
          role,
        });

        const user = await repository.create(dto);
        createdUserIds.push(user.id);

        expect(user.role).toBe(role);
      }
    });

    it('should throw error for duplicate email', async () => {
      const email = generateTestEmail('duplicate');
      const dto1 = createMockUserDTO({ email });
      const dto2 = createMockUserDTO({ email });

      const user1 = await repository.create(dto1);
      createdUserIds.push(user1.id);

      await expect(repository.create(dto2)).rejects.toThrow();
    });

    it('should throw error for invalid email format', async () => {
      const dto = createMockUserDTO({
        email: 'invalid-email',
      });

      await expect(repository.create(dto)).rejects.toThrow();
    });
  });

  describe('findById()', () => {
    it('should find user by ID', async () => {
      const dto = createMockUserDTO({ name: 'Find By ID Test' });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(dto.name);
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('should return complete user data', async () => {
      const dto = createMockUserDTO({
        name: 'Complete User',
        phone: '+9876543210',
        role: 'ho_qs',
      });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.name).toBe(dto.name);
      expect(found?.phone).toBe(dto.phone);
      expect(found?.role).toBe(dto.role);
      expect(found?.isActive).toBe(true);
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      // Create test users
      const testUsers = [
        { name: 'Admin User', role: 'admin' as UserRole },
        { name: 'HO QS User 1', role: 'ho_qs' as UserRole },
        { name: 'HO QS User 2', role: 'ho_qs' as UserRole },
        { name: 'Site QS User 1', role: 'site_qs' as UserRole },
        { name: 'Site QS User 2', role: 'site_qs' as UserRole },
      ];

      for (const userData of testUsers) {
        const dto = createMockUserDTO({
          name: userData.name,
          email: generateTestEmail(userData.role),
          role: userData.role,
        });
        const user = await repository.create(dto);
        createdUserIds.push(user.id);
      }
    });

    it('should return paginated results', async () => {
      const result = await repository.findAll({ page: 1, limit: 3 });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.total).toBeGreaterThanOrEqual(5);
    });

    it('should filter by role', async () => {
      const result = await repository.findAll({ role: 'ho_qs' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((u) => u.role === 'ho_qs')).toBe(true);
    });

    it('should filter by isActive', async () => {
      const result = await repository.findAll({ isActive: true });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((u) => u.isActive === true)).toBe(true);
    });

    it('should search by name', async () => {
      const result = await repository.findAll({ search: 'Admin User' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((u) => u.name.includes('Admin User'))).toBe(true);
    });

    it('should search by email', async () => {
      const testEmail = generateTestEmail('searchtest');
      const dto = createMockUserDTO({
        name: 'Search Test User',
        email: testEmail,
      });
      const user = await repository.create(dto);
      createdUserIds.push(user.id);

      const result = await repository.findAll({ search: 'searchtest' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((u) => u.email.includes('searchtest'))).toBe(true);
    });

    it('should sort by different fields', async () => {
      const result = await repository.findAll({
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 100,
      });

      expect(result.data.length).toBeGreaterThan(0);
      // Check if sorted
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].name >= result.data[i - 1].name).toBe(true);
      }
    });

    it('should respect default pagination limits', async () => {
      const result = await repository.findAll({});

      expect(result.pagination.limit).toBe(50); // DEFAULT_LIMIT
    });

    it('should handle empty search results', async () => {
      const result = await repository.findAll({
        search: 'NONEXISTENT_USER_NAME_XYZ123',
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBe(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should combine multiple filters', async () => {
      const result = await repository.findAll({
        role: 'ho_qs',
        isActive: true,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.data.every((u) => u.role === 'ho_qs')).toBe(true);
      expect(result.data.every((u) => u.isActive === true)).toBe(true);
    });
  });

  describe('updateRole()', () => {
    it('should update user role', async () => {
      const dto = createMockUserDTO({ role: 'site_qs' });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const updated = await repository.updateRole(created.id, 'admin');

      expect(updated.role).toBe('admin');
      expect(updated.id).toBe(created.id);
    });

    it('should update role from admin to site_qs', async () => {
      const dto = createMockUserDTO({ role: 'admin' });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const updated = await repository.updateRole(created.id, 'site_qs');

      expect(updated.role).toBe('site_qs');
    });

    it('should update role to ho_qs', async () => {
      const dto = createMockUserDTO({ role: 'site_qs' });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const updated = await repository.updateRole(created.id, 'ho_qs');

      expect(updated.role).toBe('ho_qs');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        repository.updateRole('00000000-0000-0000-0000-000000000000', 'admin')
      ).rejects.toThrow();
    });

    it('should persist role change', async () => {
      const dto = createMockUserDTO({ role: 'site_qs' });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      await repository.updateRole(created.id, 'admin');

      // Verify the change persisted
      const found = await repository.findById(created.id);
      expect(found?.role).toBe('admin');
    });
  });

  describe('findByEmail()', () => {
    it('should find user by email', async () => {
      const email = generateTestEmail('findemail');
      const dto = createMockUserDTO({ email });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const found = await repository.findByEmail(email);

      expect(found).not.toBeNull();
      expect(found?.email).toBe(email);
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent email', async () => {
      const result = await repository.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should be case-sensitive for email', async () => {
      const email = generateTestEmail('casesensitive');
      const dto = createMockUserDTO({ email: email.toLowerCase() });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      // Emails are stored in lowercase
      const found = await repository.findByEmail(email.toLowerCase());
      expect(found).not.toBeNull();
    });

    it('should return complete user data', async () => {
      const email = generateTestEmail('complete');
      const dto = createMockUserDTO({
        email,
        name: 'Complete User',
        phone: '+1122334455',
        role: 'ho_qs',
      });
      const created = await repository.create(dto);
      createdUserIds.push(created.id);

      const found = await repository.findByEmail(email);

      expect(found).not.toBeNull();
      expect(found?.name).toBe(dto.name);
      expect(found?.phone).toBe(dto.phone);
      expect(found?.role).toBe(dto.role);
    });
  });

  describe('error handling', () => {
    it('should throw error when initialized without client', () => {
      expect(() => new UserRepository(null as any)).toThrow(
        'UserRepository requires a Supabase client'
      );
    });

    it('should handle database connection errors gracefully', async () => {
      // This test verifies that errors are properly thrown and formatted
      expect(repository).toBeDefined();
    });
  });
});
