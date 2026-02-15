/**
 * User Management Module
 * Exports types, repositories, and factory for server-side usage
 */

export * from './types';
export * from './repositories';

import { UserRepository } from './repositories';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Creates a UserRepository instance using the admin Supabase client.
 * Use for server-side operations (API routes, server components).
 * Throws if Supabase is not configured.
 */
export function createUserRepository(): UserRepository {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }
  return new UserRepository(supabaseAdmin);
}
