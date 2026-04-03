/**
 * Area Repository Interface
 * Data access contract for flat project areas
 */

import type {
  Area,
  CreateAreaDTO,
  UpdateAreaDTO,
} from '../types';

export interface IAreaRepository {
  create(area: CreateAreaDTO): Promise<Area>;
  findById(id: string): Promise<Area | null>;
  findByProjectId(projectId: string): Promise<Area[]>;
  findByCode(projectId: string, code: string): Promise<Area | null>;
  update(id: string, updates: UpdateAreaDTO): Promise<Area>;
  softDelete(id: string): Promise<void>;
}
