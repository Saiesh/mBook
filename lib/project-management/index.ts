/**
 * Project Management Module
 * Exports types, repositories, and factory for server-side usage
 */

export * from './types';
export * from './repositories';

import {
  ProjectRepository,
  AreaRepository,
  ProjectTeamRepository,
} from './repositories';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Creates a ProjectRepository instance using the admin Supabase client.
 * Use for server-side operations (API routes, server components).
 * Throws if Supabase is not configured.
 */
export function createProjectRepository(): ProjectRepository {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }
  return new ProjectRepository(supabaseAdmin);
}

/**
 * Creates an AreaRepository instance using the admin Supabase client.
 * Use for server-side operations (API routes, server components).
 * Throws if Supabase is not configured.
 */
export function createAreaRepository(): AreaRepository {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }
  return new AreaRepository(supabaseAdmin);
}

/**
 * Creates a ProjectTeamRepository instance using the admin Supabase client.
 * Use for server-side operations (API routes, server components).
 * Throws if Supabase is not configured.
 */
export function createProjectTeamRepository(): ProjectTeamRepository {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }
  return new ProjectTeamRepository(supabaseAdmin);
}
