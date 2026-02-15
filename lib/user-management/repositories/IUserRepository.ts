/**
 * User Repository Interface
 * Data access contract for User entity
 */

import type {
  User,
  CreateUserDTO,
  UserFilters,
  PaginatedResult,
  UserRole,
} from '../types';

export interface IUserRepository {
  /**
   * Create a new user using Supabase Admin API
   * @param dto User creation data including temporary password
   * @returns Created user
   */
  create(dto: CreateUserDTO): Promise<User>;

  /**
   * Find a user by ID
   * @param id User UUID
   * @returns User if found, null otherwise
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find all users with optional filtering and pagination
   * @param filters Optional filters, pagination, and sorting
   * @returns Paginated result of users
   */
  findAll(filters?: UserFilters): Promise<PaginatedResult<User>>;

  /**
   * Update user role (admin only operation)
   * @param userId User ID to update
   * @param role New role to assign
   * @returns Updated user
   */
  updateRole(userId: string, role: UserRole): Promise<User>;

  /**
   * Find a user by email address
   * @param email Email address
   * @returns User if found, null otherwise
   */
  findByEmail(email: string): Promise<User | null>;
}
