/**
 * Project Repository Interface
 * Data access contract for Project entity
 */

import type {
  Project,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectFilters,
  PaginatedResult,
} from '../types';

export interface IProjectRepository {
  create(project: CreateProjectDTO, createdBy: string): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByCode(code: string): Promise<Project | null>;
  findAll(filters?: ProjectFilters): Promise<PaginatedResult<Project>>;
  update(id: string, updates: UpdateProjectDTO): Promise<Project>;
  softDelete(id: string): Promise<void>;
  exists(code: string, excludeId?: string): Promise<boolean>;
}
