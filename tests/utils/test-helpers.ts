/**
 * Test helper utilities for setting up test data and mocks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateProjectDTO,
  CreateAreaDTO,
  Project,
  Area,
  ProjectTeamMember,
} from '@/lib/project-management/types';
import type { CreateUserDTO, User, UserRole } from '@/lib/user-management/types';

/**
 * Creates a test Supabase client
 * Uses service role key for full access during tests
 */
export function createTestSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials in test environment. Check .env.test file.'
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Generates a unique test code for projects
 */
export function generateTestCode(prefix: string = 'TEST'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Creates a mock project DTO for testing
 */
export function createMockProjectDTO(
  overrides: Partial<CreateProjectDTO> = {}
): CreateProjectDTO {
  return {
    name: 'Test Project',
    code: generateTestCode(),
    clientName: 'Test Client',
    location: {
      city: 'San Francisco',
      state: 'CA',
      address: '123 Test St',
    },
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    description: 'A test project for unit tests',
    budget: 100000,
    ...overrides,
  };
}

/**
 * Creates a mock area DTO for testing
 */
export function createMockAreaDTO(
  projectId: string,
  overrides: Partial<CreateAreaDTO> = {}
): CreateAreaDTO {
  return {
    projectId,
    name: 'Test Area',
    type: 'zone',
    level: 1,
    path: '/',
    displayOrder: 1,
    color: '#3B82F6',
    ...overrides,
  };
}

/**
 * Test user ID for consistent testing
 */
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Database cleanup helper - removes all test data
 * CAUTION: Only use in test environment
 */
export async function cleanupTestData(db: SupabaseClient): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupTestData can only be called in test environment');
  }

  // Delete in order respecting foreign key constraints
  // Note: Using service role key bypasses RLS policies

  // 1. Delete team members
  await db.from('project_team_members').delete().like('project_id', '%');

  // 2. Delete areas
  await db.from('areas').delete().like('project_id', '%');

  // 3. Delete projects (soft-deleted and hard-deleted)
  await db.from('projects').delete().like('code', 'TEST-%');
  await db.from('projects').delete().like('code', 'MOCK-%');

  // 4. Clean up test users if any
  // Note: Be careful with user deletion - usually leave users intact
}

/**
 * Cleanup helper that removes only specific test entities
 */
export async function cleanupTestProject(
  db: SupabaseClient,
  projectId: string
): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupTestProject can only be called in test environment');
  }

  // Delete team members
  await db.from('project_team_members').delete().eq('project_id', projectId);

  // Delete areas
  await db.from('areas').delete().eq('project_id', projectId);

  // Delete project
  await db.from('projects').delete().eq('id', projectId);
}

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create multiple test projects in bulk
 */
export async function createBulkTestProjects(
  count: number,
  overrides: Partial<CreateProjectDTO> = {}
): Promise<CreateProjectDTO[]> {
  return Array.from({ length: count }, (_, i) =>
    createMockProjectDTO({
      name: `Test Project ${i + 1}`,
      code: generateTestCode(`BULK${i + 1}`),
      ...overrides,
    })
  );
}

/**
 * Assertion helper for project equality
 */
export function expectProjectToMatch(
  actual: Project,
  expected: Partial<Project>
): void {
  if (expected.name !== undefined) {
    expect(actual.name).toBe(expected.name);
  }
  if (expected.code !== undefined) {
    expect(actual.code).toBe(expected.code);
  }
  if (expected.clientName !== undefined) {
    expect(actual.clientName).toBe(expected.clientName);
  }
  if (expected.status !== undefined) {
    expect(actual.status).toBe(expected.status);
  }
  if (expected.budget !== undefined) {
    expect(actual.budget).toBe(expected.budget);
  }
  if (expected.location !== undefined) {
    expect(actual.location).toEqual(expected.location);
  }
}

/**
 * Assertion helper for area equality
 */
export function expectAreaToMatch(
  actual: Area,
  expected: Partial<Area>
): void {
  if (expected.name !== undefined) {
    expect(actual.name).toBe(expected.name);
  }
  if (expected.type !== undefined) {
    expect(actual.type).toBe(expected.type);
  }
  if (expected.level !== undefined) {
    expect(actual.level).toBe(expected.level);
  }
  if (expected.parentId !== undefined) {
    expect(actual.parentId).toBe(expected.parentId);
  }
  if (expected.color !== undefined) {
    expect(actual.color).toBe(expected.color);
  }
}

/**
 * Generates a unique test email for user testing
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}@test.example.com`;
}

/**
 * Creates a mock user DTO for testing
 */
export function createMockUserDTO(
  overrides: Partial<CreateUserDTO> = {}
): CreateUserDTO {
  return {
    email: generateTestEmail(),
    name: 'Test User',
    phone: '+1234567890',
    role: 'site_qs' as UserRole,
    password: 'Test@1234567',
    ...overrides,
  };
}

/**
 * Cleanup helper that removes test users
 */
export async function cleanupTestUser(
  db: SupabaseClient,
  userId: string
): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupTestUser can only be called in test environment');
  }

  // Delete from public.users (cascade will handle related records)
  await db.from('users').delete().eq('id', userId);

  // Delete from auth.users using admin API
  await db.auth.admin.deleteUser(userId);
}

/**
 * Assertion helper for user equality
 */
export function expectUserToMatch(
  actual: User,
  expected: Partial<User>
): void {
  if (expected.email !== undefined) {
    expect(actual.email).toBe(expected.email);
  }
  if (expected.name !== undefined) {
    expect(actual.name).toBe(expected.name);
  }
  if (expected.phone !== undefined) {
    expect(actual.phone).toBe(expected.phone);
  }
  if (expected.role !== undefined) {
    expect(actual.role).toBe(expected.role);
  }
  if (expected.isActive !== undefined) {
    expect(actual.isActive).toBe(expected.isActive);
  }
}
