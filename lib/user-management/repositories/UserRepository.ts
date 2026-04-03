/**
 * UserRepository - Data access layer for User entity
 * Implements user management operations via Supabase Admin API
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IUserRepository } from './IUserRepository';
import type {
  User,
  CreateUserDTO,
  UserFilters,
  PaginatedResult,
  UserRole,
} from '../types';

/** Why: explicit user row projection for list/detail queries. */
const USER_TABLE_SELECT =
  'id, email, name, phone, role, is_active, last_login_at, created_at, updated_at';

/** Database row shape (snake_case) */
interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role as UserRole,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository implements IUserRepository {
  constructor(private readonly db: SupabaseClient) {
    if (!db) {
      throw new Error('UserRepository requires a Supabase client');
    }
  }

  async create(dto: CreateUserDTO): Promise<User> {
    // Create user in auth.users using Admin API
    const { data: authData, error: authError } = await this.db.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        name: dto.name,
        phone: dto.phone ?? null,
        role: dto.role,
        is_active: true,
      },
    });

    if (authError) {
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to create user: No user data returned');
    }

    // The trigger will automatically sync to public.users
    // Wait a bit and then fetch from public.users
    await new Promise((resolve) => setTimeout(resolve, 100));

    const user = await this.findById(authData.user.id);
    if (!user) {
      throw new Error('Failed to create user: User not found after creation');
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_TABLE_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
    return data ? rowToUser(data as UserRow) : null;
  }

  async findAll(filters: UserFilters = {}): Promise<PaginatedResult<User>> {
    const page = Math.max(1, filters.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));
    const offset = (page - 1) * limit;
    const sortBy = filters.sortBy ?? 'created_at';
    const sortOrder = filters.sortOrder ?? 'desc';

    let query = this.db
      .from('users')
      .select(USER_TABLE_SELECT, { count: 'exact' });

    if (filters.role) {
      query = query.eq('role', filters.role);
    }
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term}`);
    }

    query = query.order(sortBy, {
      ascending: sortOrder === 'asc',
      nullsFirst: false,
    });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: (data ?? []).map((row) => rowToUser(row as UserRow)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async updateRole(userId: string, role: UserRole): Promise<User> {
    // Update role in auth.users metadata
    const { error: authError } = await this.db.auth.admin.updateUserById(userId, {
      user_metadata: {
        role,
      },
    });

    if (authError) {
      throw new Error(`Failed to update user role in auth: ${authError.message}`);
    }

    // Also update in public.users directly for immediate consistency
    const { data, error } = await this.db
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select(USER_TABLE_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
    if (!data) {
      throw new Error(`User not found: ${userId}`);
    }
    return rowToUser(data as UserRow);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_TABLE_SELECT)
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
    return data ? rowToUser(data as UserRow) : null;
  }
}
