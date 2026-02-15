/**
 * Supabase client mock for unit tests
 * Use this to mock Supabase operations without hitting the database
 */

import { vi } from 'vitest';

/**
 * Creates a mock Supabase client for isolated unit tests
 * Use this when you want to test repository logic without database calls
 */
export function createMockSupabaseClient() {
  const mockQuery = {
    data: null as any,
    error: null as any,
    count: null as number | null,
    status: 200,
    statusText: 'OK',
  };

  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockQuery),
    maybeSingle: vi.fn().mockResolvedValue(mockQuery),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue(mockQuery),
  };

  const mockSupabaseClient = {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue(mockQuery),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id' } },
        error: null,
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
      }),
    },
  };

  return {
    client: mockSupabaseClient,
    queryBuilder,
    mockQuery,
    // Helper to set mock response
    setMockResponse: (data: any, error: any = null, count: number | null = null) => {
      mockQuery.data = data;
      mockQuery.error = error;
      mockQuery.count = count;
    },
    // Helper to reset all mocks
    resetMocks: () => {
      vi.clearAllMocks();
      mockQuery.data = null;
      mockQuery.error = null;
      mockQuery.count = null;
    },
  };
}

/**
 * Mock error response helper
 */
export function createMockError(message: string, code?: string) {
  return {
    message,
    code: code || 'PGRST000',
    details: '',
    hint: '',
  };
}

/**
 * Mock successful response helper
 */
export function createMockSuccess<T>(data: T, count?: number) {
  return {
    data,
    error: null,
    count: count ?? null,
    status: 200,
    statusText: 'OK',
  };
}

/**
 * Example usage in tests:
 * 
 * ```typescript
 * import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';
 * import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
 * 
 * describe('ProjectRepository', () => {
 *   it('should handle errors gracefully', async () => {
 *     const mock = createMockSupabaseClient();
 *     mock.setMockResponse(null, createMockError('Connection failed'));
 *     
 *     const repo = new ProjectRepository(mock.client as any);
 *     await expect(repo.findById('123')).rejects.toThrow('Connection failed');
 *   });
 * });
 * ```
 */
