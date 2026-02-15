# Technical Design Document
## Project Creation and Management Module

**Version:** 1.0  
**Date:** February 15, 2026  
**Module:** Project Creation and Management  
**Status:** Design Phase  

---

## Table of Contents
1. [Overview](#1-overview)
2. [Entity Relationship Diagram (ERD)](#2-entity-relationship-diagram-erd)
3. [Database Schema](#3-database-schema)
4. [Low-Level Design](#4-low-level-design)
5. [Service Components](#5-service-components)
6. [API Specifications](#6-api-specifications)
7. [Technical Tasks Breakdown](#7-technical-tasks-breakdown)
8. [Implementation Guidelines](#8-implementation-guidelines)

---

## 1. Overview

### 1.1 Module Scope
The Project Creation and Management module handles:
- Project lifecycle management (Create, Read, Update, Delete)
- Project metadata and configuration
- Team member assignment
- Area/Zone management within projects
- Project status tracking
- Project search and filtering

### 1.2 Key Entities
1. **Project** - Main project entity
2. **Area** - Hierarchical areas within a project
3. **ProjectTeamMember** - Many-to-many relationship between projects and users
4. **User** - System users (HO QS, Site QS, etc.)

---

## 2. Entity Relationship Diagram (ERD)

### 2.1 ERD Diagram

```
┌─────────────────────────────────────┐
│             USERS                    │
├─────────────────────────────────────┤
│ PK │ id (UUID)                       │
│    │ email (VARCHAR, UNIQUE)         │
│    │ password_hash (VARCHAR)         │
│    │ name (VARCHAR)                  │
│    │ phone (VARCHAR)                 │
│    │ role (ENUM)                     │
│    │ is_active (BOOLEAN)             │
│    │ last_login_at (TIMESTAMP)       │
│    │ created_at (TIMESTAMP)          │
│    │ updated_at (TIMESTAMP)          │
└─────────────────────────────────────┘
            │
            │ 1:N (created by)
            ▼
┌─────────────────────────────────────────────────────────┐
│                    PROJECTS                              │
├─────────────────────────────────────────────────────────┤
│ PK │ id (UUID)                                           │
│    │ name (VARCHAR, NOT NULL)                           │
│    │ code (VARCHAR, UNIQUE, NOT NULL)                   │
│    │ client_name (VARCHAR)                              │
│    │ location_city (VARCHAR)                            │
│    │ location_state (VARCHAR)                           │
│    │ location_address (TEXT)                            │
│    │ start_date (DATE)                                  │
│    │ end_date (DATE)                                    │
│    │ status (ENUM: active, completed, on_hold)          │
│    │ description (TEXT)                                 │
│    │ budget (DECIMAL)                                   │
│ FK │ created_by (UUID -> users.id)                      │
│    │ created_at (TIMESTAMP)                             │
│    │ updated_at (TIMESTAMP)                             │
│    │ deleted_at (TIMESTAMP, NULL) -- soft delete        │
└─────────────────────────────────────────────────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────────────────────────────────────┐
│              PROJECT_TEAM_MEMBERS                        │
├─────────────────────────────────────────────────────────┤
│ PK │ id (UUID)                                           │
│ FK │ project_id (UUID -> projects.id)                   │
│ FK │ user_id (UUID -> users.id)                         │
│    │ role (ENUM: ho_qs, site_qs, project_incharge)     │
│    │ assigned_at (TIMESTAMP)                            │
│    │ removed_at (TIMESTAMP, NULL)                       │
│    │ is_active (BOOLEAN)                                │
│    │                                                     │
│    │ UNIQUE(project_id, user_id, role)                  │
└─────────────────────────────────────────────────────────┘
            │
            │ N:1
            ▼
┌─────────────────────────────────────────────────────────┐
│                      AREAS                               │
├─────────────────────────────────────────────────────────┤
│ PK │ id (UUID)                                           │
│ FK │ project_id (UUID -> projects.id)                   │
│    │ code (VARCHAR, NOT NULL)                           │
│    │ name (VARCHAR, NOT NULL)                           │
│    │ description (TEXT)                                 │
│ FK │ parent_area_id (UUID -> areas.id, NULL)           │
│    │ level (INT: 1=zone, 2=area)                       │
│    │ sort_order (INT)                                   │
│    │ is_active (BOOLEAN)                                │
│    │ created_at (TIMESTAMP)                             │
│    │ updated_at (TIMESTAMP)                             │
│    │ deleted_at (TIMESTAMP, NULL)                       │
│    │                                                     │
│    │ UNIQUE(project_id, code)                           │
└─────────────────────────────────────────────────────────┘
            │
            │ Self-referencing (parent-child)
            └──────┐
                   ▼

┌─────────────────────────────────────────────────────────┐
│                   AUDIT_LOGS                             │
├─────────────────────────────────────────────────────────┤
│ PK │ id (UUID)                                           │
│    │ entity_type (VARCHAR: project, area, etc.)        │
│    │ entity_id (UUID)                                   │
│    │ action (ENUM: create, update, delete)             │
│ FK │ user_id (UUID -> users.id)                         │
│    │ changes_before (JSONB)                             │
│    │ changes_after (JSONB)                              │
│    │ timestamp (TIMESTAMP)                              │
│    │ ip_address (INET)                                  │
│    │ user_agent (TEXT)                                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Relationships Summary

| Relationship | Type | Description |
|-------------|------|-------------|
| User → Project | 1:N | User creates many projects |
| Project → Area | 1:N | Project has many areas |
| Project ↔ User | M:N | Through ProjectTeamMember |
| Area → Area | 1:N | Self-referencing (parent-child) |
| User → AuditLog | 1:N | User performs many actions |

---

## 3. Database Schema

### 3.1 Users Table

```sql
CREATE TYPE user_role AS ENUM ('admin', 'ho_qs', 'site_qs', 'project_incharge');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'site_qs',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### 3.2 Projects Table

```sql
CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    client_name VARCHAR(255),
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_address TEXT,
    start_date DATE,
    end_date DATE,
    status project_status NOT NULL DEFAULT 'active',
    description TEXT,
    budget DECIMAL(15, 2),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT projects_end_after_start CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Indexes
CREATE INDEX idx_projects_code ON projects(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops); -- For full-text search
```

### 3.3 Project Team Members Table

```sql
CREATE TYPE team_member_role AS ENUM ('ho_qs', 'site_qs', 'project_incharge');

CREATE TABLE project_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_member_role NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    UNIQUE(project_id, user_id, role)
);

-- Indexes
CREATE INDEX idx_project_team_project_id ON project_team_members(project_id) WHERE is_active = true;
CREATE INDEX idx_project_team_user_id ON project_team_members(user_id) WHERE is_active = true;
CREATE INDEX idx_project_team_role ON project_team_members(role);
```

### 3.4 Areas Table

```sql
CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2)),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(project_id, code),
    CONSTRAINT areas_level_parent_check CHECK (
        (level = 1 AND parent_area_id IS NULL) OR
        (level = 2 AND parent_area_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_areas_project_id ON areas(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_areas_parent_area_id ON areas(parent_area_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_areas_code ON areas(code);
CREATE INDEX idx_areas_sort_order ON areas(project_id, sort_order);
```

### 3.5 Audit Logs Table

```sql
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action audit_action NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    changes_before JSONB,
    changes_after JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### 3.6 Database Triggers

```sql
-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 4. Low-Level Design

### 4.1 Class Diagram

```typescript
// Domain Models

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'ho_qs' | 'site_qs' | 'project_incharge';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Project {
  id: string;
  name: string;
  code: string;
  clientName?: string;
  location: {
    city?: string;
    state?: string;
    address?: string;
  };
  startDate?: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  description?: string;
  budget?: number;
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

interface ProjectTeamMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'ho_qs' | 'site_qs' | 'project_incharge';
  assignedAt: Date;
  removedAt?: Date;
  isActive: boolean;
}

interface Area {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  parentAreaId?: string;
  level: 1 | 2;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  userId: string;
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}
```

### 4.2 Service Layer Architecture

```typescript
// Repository Layer (Data Access)
interface IProjectRepository {
  create(project: CreateProjectDTO): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByCode(code: string): Promise<Project | null>;
  findAll(filters: ProjectFilters): Promise<PaginatedResult<Project>>;
  update(id: string, updates: UpdateProjectDTO): Promise<Project>;
  softDelete(id: string): Promise<void>;
  exists(code: string): Promise<boolean>;
}

interface IAreaRepository {
  create(area: CreateAreaDTO): Promise<Area>;
  findById(id: string): Promise<Area | null>;
  findByProjectId(projectId: string): Promise<Area[]>;
  findByCode(projectId: string, code: string): Promise<Area | null>;
  update(id: string, updates: UpdateAreaDTO): Promise<Area>;
  softDelete(id: string): Promise<void>;
  getHierarchy(projectId: string): Promise<AreaHierarchy[]>;
}

interface IProjectTeamRepository {
  addMember(member: AddTeamMemberDTO): Promise<ProjectTeamMember>;
  removeMember(projectId: string, userId: string, role: string): Promise<void>;
  getTeamMembers(projectId: string): Promise<ProjectTeamMember[]>;
  getUserProjects(userId: string): Promise<Project[]>;
}

// Service Layer (Business Logic)
interface IProjectService {
  createProject(data: CreateProjectDTO, userId: string): Promise<Project>;
  getProject(id: string): Promise<ProjectWithTeam>;
  listProjects(filters: ProjectFilters, userId: string): Promise<PaginatedResult<Project>>;
  updateProject(id: string, data: UpdateProjectDTO, userId: string): Promise<Project>;
  deleteProject(id: string, userId: string): Promise<void>;
  searchProjects(query: string, userId: string): Promise<Project[]>;
  getProjectStats(id: string): Promise<ProjectStats>;
}

interface IAreaService {
  createArea(data: CreateAreaDTO, userId: string): Promise<Area>;
  getArea(id: string): Promise<Area>;
  listAreas(projectId: string): Promise<Area[]>;
  getAreaHierarchy(projectId: string): Promise<AreaHierarchy[]>;
  updateArea(id: string, data: UpdateAreaDTO, userId: string): Promise<Area>;
  deleteArea(id: string, userId: string): Promise<void>;
  reorderAreas(projectId: string, areaIds: string[]): Promise<void>;
}

// DTOs (Data Transfer Objects)
interface CreateProjectDTO {
  name: string;
  code: string;
  clientName?: string;
  location?: {
    city?: string;
    state?: string;
    address?: string;
  };
  startDate?: string; // ISO date
  endDate?: string;
  description?: string;
  budget?: number;
  teamMembers?: {
    userId: string;
    role: 'ho_qs' | 'site_qs' | 'project_incharge';
  }[];
}

interface UpdateProjectDTO {
  name?: string;
  clientName?: string;
  location?: {
    city?: string;
    state?: string;
    address?: string;
  };
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled';
  description?: string;
  budget?: number;
}

interface CreateAreaDTO {
  projectId: string;
  code: string;
  name: string;
  description?: string;
  parentAreaId?: string;
  sortOrder?: number;
}

interface UpdateAreaDTO {
  code?: string;
  name?: string;
  description?: string;
  parentAreaId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface ProjectFilters {
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled';
  search?: string; // Search by name or code
  createdBy?: string;
  startDateFrom?: string;
  startDateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ProjectWithTeam extends Project {
  teamMembers: {
    user: User;
    role: string;
    assignedAt: Date;
  }[];
  areas: Area[];
  stats: {
    totalAreas: number;
    totalMeasurements: number;
    totalBills: number;
  };
}

interface AreaHierarchy extends Area {
  children: Area[];
}

interface ProjectStats {
  totalAreas: number;
  totalBOQItems: number;
  totalMeasurements: number;
  totalBills: number;
  totalAmount: number;
}
```

### 4.3 Validation Rules

```typescript
// Validation Schemas (using Joi or Yup)

const createProjectSchema = {
  name: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 255,
    trim: true
  },
  code: {
    type: 'string',
    required: true,
    pattern: /^[A-Z0-9-]+$/,
    minLength: 3,
    maxLength: 50,
    unique: true
  },
  clientName: {
    type: 'string',
    optional: true,
    maxLength: 255
  },
  location: {
    city: { type: 'string', optional: true, maxLength: 100 },
    state: { type: 'string', optional: true, maxLength: 100 },
    address: { type: 'string', optional: true, maxLength: 500 }
  },
  startDate: {
    type: 'date',
    optional: true,
    format: 'YYYY-MM-DD'
  },
  endDate: {
    type: 'date',
    optional: true,
    format: 'YYYY-MM-DD',
    validate: 'must be after startDate'
  },
  budget: {
    type: 'number',
    optional: true,
    min: 0,
    max: 999999999999.99
  },
  teamMembers: {
    type: 'array',
    optional: true,
    items: {
      userId: { type: 'uuid', required: true },
      role: { type: 'enum', values: ['ho_qs', 'site_qs', 'project_incharge'] }
    }
  }
};

const createAreaSchema = {
  projectId: {
    type: 'uuid',
    required: true,
    exists: 'projects.id'
  },
  code: {
    type: 'string',
    required: true,
    pattern: /^[A-Z0-9-]+$/,
    minLength: 2,
    maxLength: 50,
    uniqueWithin: 'project'
  },
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 255
  },
  parentAreaId: {
    type: 'uuid',
    optional: true,
    exists: 'areas.id',
    validate: 'must be in same project'
  },
  sortOrder: {
    type: 'number',
    optional: true,
    min: 0
  }
};
```

---

## 5. Service Components

### 5.1 Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY / ROUTER                   │
│                  (Express.js / FastAPI)                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  MIDDLEWARE LAYER                        │
├─────────────────────────────────────────────────────────┤
│  - Authentication Middleware (JWT)                       │
│  - Authorization Middleware (RBAC)                       │
│  - Request Validation Middleware                         │
│  - Error Handling Middleware                             │
│  - Audit Logging Middleware                              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER                       │
├─────────────────────────────────────────────────────────┤
│  - ProjectController                                     │
│  - AreaController                                        │
│  - ProjectTeamController                                 │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                         │
├─────────────────────────────────────────────────────────┤
│  - ProjectService                                        │
│  - AreaService                                           │
│  - ProjectTeamService                                    │
│  - AuditLogService                                       │
│  - ValidationService                                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  REPOSITORY LAYER                        │
├─────────────────────────────────────────────────────────┤
│  - ProjectRepository                                     │
│  - AreaRepository                                        │
│  - ProjectTeamRepository                                 │
│  - AuditLogRepository                                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      DATABASE                            │
│                   (PostgreSQL 14+)                       │
└─────────────────────────────────────────────────────────┘
```

### 5.2 ProjectService Implementation

```typescript
// services/ProjectService.ts

import { IProjectRepository, IProjectTeamRepository, IAuditLogRepository } from '../repositories';
import { CreateProjectDTO, UpdateProjectDTO, ProjectFilters } from '../types';
import { ValidationError, NotFoundError, ConflictError } from '../errors';

export class ProjectService {
  constructor(
    private projectRepo: IProjectRepository,
    private teamRepo: IProjectTeamRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async createProject(data: CreateProjectDTO, userId: string): Promise<Project> {
    // 1. Validate input
    await this.validateCreateProject(data);
    
    // 2. Check if project code already exists
    const exists = await this.projectRepo.exists(data.code);
    if (exists) {
      throw new ConflictError(`Project with code ${data.code} already exists`);
    }
    
    // 3. Create project
    const project = await this.projectRepo.create({
      ...data,
      createdBy: userId,
      status: 'active'
    });
    
    // 4. Add team members if provided
    if (data.teamMembers && data.teamMembers.length > 0) {
      for (const member of data.teamMembers) {
        await this.teamRepo.addMember({
          projectId: project.id,
          userId: member.userId,
          role: member.role
        });
      }
    }
    
    // 5. Create audit log
    await this.auditRepo.create({
      entityType: 'project',
      entityId: project.id,
      action: 'create',
      userId,
      changesAfter: project
    });
    
    return project;
  }

  async getProject(id: string, userId: string): Promise<ProjectWithTeam> {
    // 1. Fetch project
    const project = await this.projectRepo.findById(id);
    if (!project || project.deletedAt) {
      throw new NotFoundError('Project not found');
    }
    
    // 2. Check authorization
    await this.checkProjectAccess(id, userId);
    
    // 3. Fetch team members
    const teamMembers = await this.teamRepo.getTeamMembers(id);
    
    // 4. Fetch areas
    const areas = await this.areaRepo.findByProjectId(id);
    
    // 5. Fetch stats
    const stats = await this.getProjectStats(id);
    
    return {
      ...project,
      teamMembers,
      areas,
      stats
    };
  }

  async listProjects(
    filters: ProjectFilters,
    userId: string
  ): Promise<PaginatedResult<Project>> {
    // 1. Apply user-specific filters (only show projects user has access to)
    const userRole = await this.getUserRole(userId);
    
    let projectFilters = { ...filters };
    if (userRole !== 'admin') {
      // Non-admin users can only see their assigned projects
      const userProjects = await this.teamRepo.getUserProjects(userId);
      projectFilters.projectIds = userProjects.map(p => p.id);
    }
    
    // 2. Fetch paginated projects
    return this.projectRepo.findAll(projectFilters);
  }

  async updateProject(
    id: string,
    data: UpdateProjectDTO,
    userId: string
  ): Promise<Project> {
    // 1. Check if project exists
    const existing = await this.projectRepo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Project not found');
    }
    
    // 2. Check authorization (only HO QS or admin can update)
    await this.checkUpdatePermission(id, userId);
    
    // 3. Validate updates
    await this.validateUpdateProject(data);
    
    // 4. Update project
    const updated = await this.projectRepo.update(id, data);
    
    // 5. Create audit log
    await this.auditRepo.create({
      entityType: 'project',
      entityId: id,
      action: 'update',
      userId,
      changesBefore: existing,
      changesAfter: updated
    });
    
    return updated;
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    // 1. Check if project exists
    const project = await this.projectRepo.findById(id);
    if (!project || project.deletedAt) {
      throw new NotFoundError('Project not found');
    }
    
    // 2. Check authorization (only admin can delete)
    const userRole = await this.getUserRole(userId);
    if (userRole !== 'admin') {
      throw new ForbiddenError('Only admins can delete projects');
    }
    
    // 3. Check if project has active bills (prevent deletion)
    const hasActiveBills = await this.checkActiveBills(id);
    if (hasActiveBills) {
      throw new ConflictError('Cannot delete project with active bills');
    }
    
    // 4. Soft delete project
    await this.projectRepo.softDelete(id);
    
    // 5. Create audit log
    await this.auditRepo.create({
      entityType: 'project',
      entityId: id,
      action: 'delete',
      userId,
      changesBefore: project
    });
  }

  async searchProjects(query: string, userId: string): Promise<Project[]> {
    const filters: ProjectFilters = {
      search: query,
      limit: 20
    };
    
    const result = await this.listProjects(filters, userId);
    return result.data;
  }

  // Private helper methods
  private async validateCreateProject(data: CreateProjectDTO): Promise<void> {
    // Implement validation logic
    if (!data.name || data.name.trim().length < 3) {
      throw new ValidationError('Project name must be at least 3 characters');
    }
    
    if (!data.code || !/^[A-Z0-9-]+$/.test(data.code)) {
      throw new ValidationError('Project code must contain only uppercase letters, numbers, and hyphens');
    }
    
    if (data.endDate && data.startDate && new Date(data.endDate) < new Date(data.startDate)) {
      throw new ValidationError('End date must be after start date');
    }
  }

  private async checkProjectAccess(projectId: string, userId: string): Promise<void> {
    const userRole = await this.getUserRole(userId);
    if (userRole === 'admin') return; // Admin has access to all projects
    
    const isMember = await this.teamRepo.isMember(projectId, userId);
    if (!isMember) {
      throw new ForbiddenError('You do not have access to this project');
    }
  }
}
```

### 5.3 AreaService Implementation

```typescript
// services/AreaService.ts

export class AreaService {
  constructor(
    private areaRepo: IAreaRepository,
    private projectRepo: IProjectRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async createArea(data: CreateAreaDTO, userId: string): Promise<Area> {
    // 1. Validate input
    await this.validateCreateArea(data);
    
    // 2. Check if project exists
    const project = await this.projectRepo.findById(data.projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    
    // 3. Check if code already exists in project
    const existing = await this.areaRepo.findByCode(data.projectId, data.code);
    if (existing) {
      throw new ConflictError(`Area with code ${data.code} already exists in this project`);
    }
    
    // 4. Validate parent area if provided
    if (data.parentAreaId) {
      const parentArea = await this.areaRepo.findById(data.parentAreaId);
      if (!parentArea || parentArea.projectId !== data.projectId) {
        throw new ValidationError('Invalid parent area');
      }
      if (parentArea.level !== 1) {
        throw new ValidationError('Parent area must be a zone (level 1)');
      }
    }
    
    // 5. Determine level
    const level = data.parentAreaId ? 2 : 1;
    
    // 6. Create area
    const area = await this.areaRepo.create({
      ...data,
      level,
      sortOrder: data.sortOrder || 0
    });
    
    // 7. Create audit log
    await this.auditRepo.create({
      entityType: 'area',
      entityId: area.id,
      action: 'create',
      userId,
      changesAfter: area
    });
    
    return area;
  }

  async getAreaHierarchy(projectId: string): Promise<AreaHierarchy[]> {
    // 1. Fetch all areas for project
    const areas = await this.areaRepo.findByProjectId(projectId);
    
    // 2. Build hierarchy
    const areaMap = new Map<string, AreaHierarchy>();
    const rootAreas: AreaHierarchy[] = [];
    
    // Initialize all areas
    areas.forEach(area => {
      areaMap.set(area.id, { ...area, children: [] });
    });
    
    // Build tree
    areas.forEach(area => {
      const areaNode = areaMap.get(area.id)!;
      if (area.parentAreaId) {
        const parent = areaMap.get(area.parentAreaId);
        if (parent) {
          parent.children.push(areaNode);
        }
      } else {
        rootAreas.push(areaNode);
      }
    });
    
    // Sort by sortOrder
    const sortAreas = (areas: AreaHierarchy[]) => {
      areas.sort((a, b) => a.sortOrder - b.sortOrder);
      areas.forEach(area => sortAreas(area.children));
    };
    sortAreas(rootAreas);
    
    return rootAreas;
  }

  async reorderAreas(projectId: string, areaIds: string[]): Promise<void> {
    // Update sort order for each area
    for (let i = 0; i < areaIds.length; i++) {
      await this.areaRepo.update(areaIds[i], { sortOrder: i });
    }
  }
}
```

---

## 6. API Specifications

### 6.1 Authentication

All endpoints require JWT authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### 6.2 Project Endpoints

#### 6.2.1 Create Project

**Endpoint:** `POST /api/v1/projects`

**Request:**
```json
{
  "name": "Sattva City",
  "code": "SAT-001",
  "clientName": "Sattva City Pvt Ltd",
  "location": {
    "city": "Bangalore",
    "state": "Karnataka",
    "address": "Whitefield, Bangalore"
  },
  "startDate": "2024-01-01",
  "endDate": "2025-12-31",
  "description": "Luxury apartment complex",
  "budget": 500000000.00,
  "teamMembers": [
    {
      "userId": "user-uuid-1",
      "role": "ho_qs"
    },
    {
      "userId": "user-uuid-2",
      "role": "site_qs"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "proj-uuid-1",
    "name": "Sattva City",
    "code": "SAT-001",
    "clientName": "Sattva City Pvt Ltd",
    "location": {
      "city": "Bangalore",
      "state": "Karnataka",
      "address": "Whitefield, Bangalore"
    },
    "startDate": "2024-01-01",
    "endDate": "2025-12-31",
    "status": "active",
    "description": "Luxury apartment complex",
    "budget": 500000000.00,
    "createdBy": "user-uuid-current",
    "createdAt": "2026-02-15T10:30:00Z",
    "updatedAt": "2026-02-15T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing or invalid token
- `409 Conflict` - Project code already exists

---

#### 6.2.2 Get Project Details

**Endpoint:** `GET /api/v1/projects/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "proj-uuid-1",
    "name": "Sattva City",
    "code": "SAT-001",
    "clientName": "Sattva City Pvt Ltd",
    "location": {
      "city": "Bangalore",
      "state": "Karnataka",
      "address": "Whitefield, Bangalore"
    },
    "startDate": "2024-01-01",
    "endDate": "2025-12-31",
    "status": "active",
    "description": "Luxury apartment complex",
    "budget": 500000000.00,
    "createdBy": "user-uuid-current",
    "createdAt": "2026-02-15T10:30:00Z",
    "updatedAt": "2026-02-15T10:30:00Z",
    "teamMembers": [
      {
        "user": {
          "id": "user-uuid-1",
          "name": "John Doe",
          "email": "john@example.com",
          "role": "ho_qs"
        },
        "role": "ho_qs",
        "assignedAt": "2026-02-15T10:30:00Z"
      }
    ],
    "areas": [
      {
        "id": "area-uuid-1",
        "code": "ZONE-01",
        "name": "Marketing Office Drop Off",
        "level": 1
      }
    ],
    "stats": {
      "totalAreas": 8,
      "totalBOQItems": 50,
      "totalMeasurements": 156,
      "totalBills": 5,
      "totalAmount": 19221234.56
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - Project not found
- `403 Forbidden` - No access to project

---

#### 6.2.3 List Projects

**Endpoint:** `GET /api/v1/projects`

**Query Parameters:**
- `status` (optional): Filter by status (active, completed, on_hold, cancelled)
- `search` (optional): Search by name or code
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page
- `sortBy` (optional, default: updated_at): Sort field
- `sortOrder` (optional, default: desc): Sort order (asc, desc)

**Example:** `GET /api/v1/projects?status=active&search=sattva&page=1&limit=20`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "proj-uuid-1",
      "name": "Sattva City",
      "code": "SAT-001",
      "clientName": "Sattva City Pvt Ltd",
      "status": "active",
      "location": {
        "city": "Bangalore",
        "state": "Karnataka"
      },
      "startDate": "2024-01-01",
      "endDate": "2025-12-31",
      "createdAt": "2026-02-15T10:30:00Z",
      "updatedAt": "2026-02-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### 6.2.4 Update Project

**Endpoint:** `PUT /api/v1/projects/:id`

**Request:**
```json
{
  "name": "Sattva City Phase 2",
  "status": "active",
  "endDate": "2026-06-30",
  "budget": 600000000.00
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "proj-uuid-1",
    "name": "Sattva City Phase 2",
    "code": "SAT-001",
    // ... updated fields
    "updatedAt": "2026-02-15T11:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation error
- `404 Not Found` - Project not found
- `403 Forbidden` - No permission to update

---

#### 6.2.5 Delete Project

**Endpoint:** `DELETE /api/v1/projects/:id`

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - Project not found
- `403 Forbidden` - Only admins can delete
- `409 Conflict` - Cannot delete project with active bills

---

#### 6.2.6 Search Projects

**Endpoint:** `GET /api/v1/projects/search`

**Query Parameters:**
- `q` (required): Search query

**Example:** `GET /api/v1/projects/search?q=sattva`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "proj-uuid-1",
      "name": "Sattva City",
      "code": "SAT-001",
      "clientName": "Sattva City Pvt Ltd",
      "status": "active"
    }
  ]
}
```

---

### 6.3 Area Endpoints

#### 6.3.1 Create Area

**Endpoint:** `POST /api/v1/areas`

**Request:**
```json
{
  "projectId": "proj-uuid-1",
  "code": "ZONE-01",
  "name": "Marketing Office Drop Off",
  "description": "Entry zone for marketing office",
  "parentAreaId": null,
  "sortOrder": 0
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "area-uuid-1",
    "projectId": "proj-uuid-1",
    "code": "ZONE-01",
    "name": "Marketing Office Drop Off",
    "description": "Entry zone for marketing office",
    "parentAreaId": null,
    "level": 1,
    "sortOrder": 0,
    "isActive": true,
    "createdAt": "2026-02-15T10:35:00Z",
    "updatedAt": "2026-02-15T10:35:00Z"
  }
}
```

---

#### 6.3.2 List Areas

**Endpoint:** `GET /api/v1/projects/:projectId/areas`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "area-uuid-1",
      "projectId": "proj-uuid-1",
      "code": "ZONE-01",
      "name": "Marketing Office Drop Off",
      "level": 1,
      "sortOrder": 0,
      "children": [
        {
          "id": "area-uuid-2",
          "code": "AREA-01-01",
          "name": "Entrance",
          "level": 2,
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

---

#### 6.3.3 Get Area Hierarchy

**Endpoint:** `GET /api/v1/projects/:projectId/areas/hierarchy`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "area-uuid-1",
      "code": "ZONE-01",
      "name": "Marketing Office Drop Off",
      "level": 1,
      "children": [
        {
          "id": "area-uuid-2",
          "code": "AREA-01-01",
          "name": "Entrance",
          "level": 2,
          "children": []
        }
      ]
    }
  ]
}
```

---

#### 6.3.4 Update Area

**Endpoint:** `PUT /api/v1/areas/:id`

**Request:**
```json
{
  "name": "Marketing Office Drop Off - Updated",
  "description": "Updated description"
}
```

**Response:** `200 OK`

---

#### 6.3.5 Delete Area

**Endpoint:** `DELETE /api/v1/areas/:id`

**Response:** `204 No Content`

**Error Responses:**
- `409 Conflict` - Cannot delete area with measurements or BOQ mappings

---

#### 6.3.6 Reorder Areas

**Endpoint:** `PUT /api/v1/projects/:projectId/areas/reorder`

**Request:**
```json
{
  "areaIds": [
    "area-uuid-3",
    "area-uuid-1",
    "area-uuid-2"
  ]
}
```

**Response:** `200 OK`

---

### 6.4 Project Team Endpoints

#### 6.4.1 Add Team Member

**Endpoint:** `POST /api/v1/projects/:projectId/team`

**Request:**
```json
{
  "userId": "user-uuid-3",
  "role": "site_qs"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "team-member-uuid-1",
    "projectId": "proj-uuid-1",
    "userId": "user-uuid-3",
    "role": "site_qs",
    "assignedAt": "2026-02-15T10:40:00Z",
    "isActive": true
  }
}
```

---

#### 6.4.2 List Team Members

**Endpoint:** `GET /api/v1/projects/:projectId/team`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "team-member-uuid-1",
      "role": "ho_qs",
      "assignedAt": "2026-02-15T10:30:00Z",
      "user": {
        "id": "user-uuid-1",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "ho_qs"
      }
    }
  ]
}
```

---

#### 6.4.3 Remove Team Member

**Endpoint:** `DELETE /api/v1/projects/:projectId/team/:userId`

**Response:** `204 No Content`

---

### 6.5 Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "validation error details"
    }
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `CONFLICT` - Resource already exists or state conflict
- `INTERNAL_ERROR` - Server error

---

## 7. Technical Tasks Breakdown

### Phase 1: Database Setup (Week 1)

#### Task 1.1: Database Schema Creation
**Priority:** P0  
**Effort:** 4 hours  
**Dependencies:** None

**Subtasks:**
- [ ] Create PostgreSQL database instance
- [ ] Create `users` table with indexes
- [ ] Create `projects` table with indexes
- [ ] Create `project_team_members` table
- [ ] Create `areas` table with indexes
- [ ] Create `audit_logs` table with indexes
- [ ] Create ENUM types for roles and statuses
- [ ] Create database triggers for `updated_at`
- [ ] Create constraints and foreign keys
- [ ] Test database schema with sample data

**Acceptance Criteria:**
- All tables created successfully
- All indexes created
- Foreign key constraints working
- Triggers auto-updating timestamps
- No errors in schema validation

---

#### Task 1.2: Database Migrations Setup
**Priority:** P0  
**Effort:** 2 hours  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Setup migration tool (Flyway, Prisma Migrate, or Alembic)
- [ ] Create initial migration scripts
- [ ] Test migration up and down
- [ ] Document migration process
- [ ] Setup CI/CD for migrations

**Acceptance Criteria:**
- Migrations run successfully
- Rollback works correctly
- Migration scripts versioned in Git

---

### Phase 2: Repository Layer (Week 1)

#### Task 2.1: ProjectRepository Implementation
**Priority:** P0  
**Effort:** 8 hours  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Implement `create()` method
- [ ] Implement `findById()` method
- [ ] Implement `findByCode()` method
- [ ] Implement `findAll()` with pagination and filters
- [ ] Implement `update()` method
- [ ] Implement `softDelete()` method
- [ ] Implement `exists()` method
- [ ] Write unit tests for all methods
- [ ] Test with PostgreSQL

**Acceptance Criteria:**
- All CRUD operations working
- Pagination working correctly
- Filters (status, search) working
- Soft delete implemented
- Unit tests passing with >80% coverage

---

#### Task 2.2: AreaRepository Implementation
**Priority:** P0  
**Effort:** 6 hours  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Implement `create()` method
- [ ] Implement `findById()` method
- [ ] Implement `findByProjectId()` method
- [ ] Implement `findByCode()` method
- [ ] Implement `update()` method
- [ ] Implement `softDelete()` method
- [ ] Implement `getHierarchy()` method (recursive query)
- [ ] Write unit tests
- [ ] Test hierarchical queries

**Acceptance Criteria:**
- All CRUD operations working
- Hierarchical queries working correctly
- Parent-child relationships maintained
- Unit tests passing

---

#### Task 2.3: ProjectTeamRepository Implementation
**Priority:** P0  
**Effort:** 4 hours  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Implement `addMember()` method
- [ ] Implement `removeMember()` method
- [ ] Implement `getTeamMembers()` method
- [ ] Implement `getUserProjects()` method
- [ ] Implement `isMember()` method
- [ ] Write unit tests

**Acceptance Criteria:**
- Can add/remove team members
- Can query team by project
- Can query projects by user
- Unit tests passing

---

### Phase 3: Service Layer (Week 2)

#### Task 3.1: ProjectService Implementation
**Priority:** P0  
**Effort:** 12 hours  
**Dependencies:** Task 2.1, 2.3

**Subtasks:**
- [ ] Implement `createProject()` method with validation
- [ ] Implement `getProject()` method with authorization
- [ ] Implement `listProjects()` method with filters
- [ ] Implement `updateProject()` method
- [ ] Implement `deleteProject()` method
- [ ] Implement `searchProjects()` method
- [ ] Implement `getProjectStats()` method
- [ ] Add audit logging to all methods
- [ ] Write unit tests
- [ ] Write integration tests

**Acceptance Criteria:**
- All business logic working
- Validation rules enforced
- Authorization checks working
- Audit logging functional
- Tests passing with >80% coverage

---

#### Task 3.2: AreaService Implementation
**Priority:** P0  
**Effort:** 8 hours  
**Dependencies:** Task 2.2

**Subtasks:**
- [ ] Implement `createArea()` method with validation
- [ ] Implement `getArea()` method
- [ ] Implement `listAreas()` method
- [ ] Implement `getAreaHierarchy()` method
- [ ] Implement `updateArea()` method
- [ ] Implement `deleteArea()` method
- [ ] Implement `reorderAreas()` method
- [ ] Add audit logging
- [ ] Write unit tests
- [ ] Write integration tests

**Acceptance Criteria:**
- All area operations working
- Hierarchy building correct
- Reordering functional
- Tests passing

---

### Phase 4: API Layer (Week 2-3)

#### Task 4.1: Project API Endpoints
**Priority:** P0  
**Effort:** 10 hours  
**Dependencies:** Task 3.1

**Subtasks:**
- [ ] Setup Express.js/FastAPI router
- [ ] Implement `POST /api/v1/projects` endpoint
- [ ] Implement `GET /api/v1/projects/:id` endpoint
- [ ] Implement `GET /api/v1/projects` endpoint
- [ ] Implement `PUT /api/v1/projects/:id` endpoint
- [ ] Implement `DELETE /api/v1/projects/:id` endpoint
- [ ] Implement `GET /api/v1/projects/search` endpoint
- [ ] Add request validation middleware
- [ ] Add authentication middleware
- [ ] Add authorization middleware
- [ ] Write API tests (Supertest/pytest)
- [ ] Test with Postman

**Acceptance Criteria:**
- All endpoints working
- Request validation working
- Authentication required
- Authorization enforced
- API tests passing
- Postman collection created

---

#### Task 4.2: Area API Endpoints
**Priority:** P0  
**Effort:** 8 hours  
**Dependencies:** Task 3.2

**Subtasks:**
- [ ] Implement `POST /api/v1/areas` endpoint
- [ ] Implement `GET /api/v1/projects/:projectId/areas` endpoint
- [ ] Implement `GET /api/v1/projects/:projectId/areas/hierarchy` endpoint
- [ ] Implement `PUT /api/v1/areas/:id` endpoint
- [ ] Implement `DELETE /api/v1/areas/:id` endpoint
- [ ] Implement `PUT /api/v1/projects/:projectId/areas/reorder` endpoint
- [ ] Add middleware
- [ ] Write API tests

**Acceptance Criteria:**
- All endpoints working
- API tests passing

---

#### Task 4.3: Project Team API Endpoints
**Priority:** P0  
**Effort:** 4 hours  
**Dependencies:** Task 3.1

**Subtasks:**
- [ ] Implement `POST /api/v1/projects/:projectId/team` endpoint
- [ ] Implement `GET /api/v1/projects/:projectId/team` endpoint
- [ ] Implement `DELETE /api/v1/projects/:projectId/team/:userId` endpoint
- [ ] Add middleware
- [ ] Write API tests

**Acceptance Criteria:**
- All endpoints working
- API tests passing

---

### Phase 5: Frontend Implementation (Week 3-4)

#### Task 5.1: Project List Page
**Priority:** P0  
**Effort:** 8 hours  
**Dependencies:** Task 4.1

**Subtasks:**
- [ ] Create ProjectList component
- [ ] Implement project table with pagination
- [ ] Add search functionality
- [ ] Add status filter
- [ ] Add sorting
- [ ] Connect to API
- [ ] Add loading and error states
- [ ] Style with Material-UI
- [ ] Write component tests

**Acceptance Criteria:**
- Project list displays correctly
- Pagination working
- Search and filters functional
- API integration working

---

#### Task 5.2: Create/Edit Project Form
**Priority:** P0  
**Effort:** 12 hours  
**Dependencies:** Task 4.1

**Subtasks:**
- [ ] Create ProjectForm component
- [ ] Add form fields (name, code, client, location, dates)
- [ ] Add team member selector (multi-select)
- [ ] Implement form validation
- [ ] Connect to create/update APIs
- [ ] Add success/error notifications
- [ ] Handle loading states
- [ ] Style form
- [ ] Write component tests

**Acceptance Criteria:**
- Form validates inputs
- Can create new project
- Can edit existing project
- Team members can be added
- Error handling working

---

#### Task 5.3: Project Details Page
**Priority:** P0  
**Effort:** 10 hours  
**Dependencies:** Task 4.1, 4.2

**Subtasks:**
- [ ] Create ProjectDetails component
- [ ] Display project information
- [ ] Show team members list
- [ ] Show areas list
- [ ] Show project stats
- [ ] Add edit button
- [ ] Add delete button with confirmation
- [ ] Connect to APIs
- [ ] Write component tests

**Acceptance Criteria:**
- Project details display correctly
- Team members shown
- Areas shown
- Stats calculated correctly

---

#### Task 5.4: Area Management UI
**Priority:** P0  
**Effort:** 12 hours  
**Dependencies:** Task 4.2

**Subtasks:**
- [ ] Create AreaList component
- [ ] Display areas in hierarchical tree
- [ ] Add create area form
- [ ] Add edit area inline
- [ ] Add delete area with confirmation
- [ ] Implement drag-and-drop reordering
- [ ] Connect to APIs
- [ ] Write component tests

**Acceptance Criteria:**
- Areas display in tree structure
- Can create/edit/delete areas
- Drag-and-drop reordering works
- Parent-child relationships maintained

---

### Phase 6: Testing & Documentation (Week 4)

#### Task 6.1: Integration Testing
**Priority:** P1  
**Effort:** 8 hours  
**Dependencies:** All previous tasks

**Subtasks:**
- [ ] Write end-to-end tests for project creation flow
- [ ] Test project listing and filtering
- [ ] Test project update flow
- [ ] Test area management flow
- [ ] Test team member management
- [ ] Test authorization scenarios
- [ ] Test error scenarios

**Acceptance Criteria:**
- All integration tests passing
- Edge cases covered
- Error scenarios tested

---

#### Task 6.2: API Documentation
**Priority:** P1  
**Effort:** 4 hours  
**Dependencies:** Task 4.1, 4.2, 4.3

**Subtasks:**
- [ ] Setup Swagger/OpenAPI
- [ ] Document all endpoints
- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add authentication documentation
- [ ] Generate API docs

**Acceptance Criteria:**
- Complete API documentation
- All endpoints documented
- Examples provided
- Docs accessible via /api/docs

---

#### Task 6.3: User Documentation
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Task 5.1, 5.2, 5.3, 5.4

**Subtasks:**
- [ ] Create user guide for project creation
- [ ] Document area management
- [ ] Add screenshots
- [ ] Create video tutorial
- [ ] Document common workflows

**Acceptance Criteria:**
- User guide complete
- Screenshots included
- Video tutorial recorded

---

## 8. Implementation Guidelines

### 8.1 Code Standards

**General:**
- Follow TypeScript/Python style guide
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Follow DRY principle

**TypeScript/Node.js:**
- Use TypeScript with strict mode
- Use ESLint with recommended rules
- Use Prettier for formatting
- Use async/await (not callbacks)
- Use ES6+ features

**Python:**
- Follow PEP 8 style guide
- Use type hints
- Use Black for formatting
- Use pylint/flake8
- Use async/await where appropriate

### 8.2 Testing Standards

**Unit Tests:**
- Test coverage >80%
- Test all business logic
- Mock external dependencies
- Use descriptive test names

**Integration Tests:**
- Test API endpoints
- Test database operations
- Test with real database (test DB)
- Clean up test data

**E2E Tests:**
- Test complete user flows
- Test critical paths
- Run before deployment

### 8.3 Security Guidelines

**Authentication:**
- Use JWT tokens
- Hash passwords with bcrypt (10+ rounds)
- Implement token refresh
- Secure token storage

**Authorization:**
- Check permissions on every request
- Use role-based access control
- Validate project access
- Audit sensitive operations

**Input Validation:**
- Validate all inputs
- Sanitize user input
- Prevent SQL injection (use parameterized queries)
- Prevent XSS attacks

**Data Protection:**
- Use HTTPS in production
- Encrypt sensitive data at rest
- Implement rate limiting
- Log security events

### 8.4 Performance Guidelines

**Database:**
- Use indexes on foreign keys
- Optimize queries (avoid N+1)
- Use connection pooling
- Monitor slow queries

**API:**
- Implement pagination (default 20 items)
- Cache frequently accessed data
- Use database transactions
- Optimize response size

**Frontend:**
- Lazy load components
- Debounce search inputs
- Cache API responses
- Minimize bundle size

### 8.5 Monitoring & Logging

**Logging:**
- Log all errors
- Log security events (auth failures, permission denials)
- Log API requests (method, path, user, status, duration)
- Use structured logging (JSON)
- Don't log sensitive data (passwords, tokens)

**Monitoring:**
- Monitor API response times
- Monitor database query times
- Monitor error rates
- Setup alerts for critical issues

---

## Appendix

### A. Database Migration Scripts

**Initial Migration (001_create_schema.sql):**
```sql
-- See Section 3 for full schema
```

### B. Sample API Requests (Postman Collection)

```json
{
  "info": {
    "name": "M-Book API - Project Management",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/"
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"user@example.com\",\n  \"password\": \"password123\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Projects",
      "item": [
        {
          "name": "Create Project",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}",
                "type": "text"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Sattva City\",\n  \"code\": \"SAT-001\",\n  \"clientName\": \"Sattva City Pvt Ltd\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/v1/projects",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "projects"]
            }
          }
        }
      ]
    }
  ]
}
```

### C. Test Data

**Sample Projects:**
```json
[
  {
    "name": "Sattva City",
    "code": "SAT-001",
    "clientName": "Sattva City Pvt Ltd",
    "location": {
      "city": "Bangalore",
      "state": "Karnataka"
    },
    "startDate": "2024-01-01",
    "endDate": "2025-12-31"
  },
  {
    "name": "Brigade Meadows",
    "code": "BRG-002",
    "clientName": "Brigade Group",
    "location": {
      "city": "Bangalore",
      "state": "Karnataka"
    },
    "startDate": "2024-03-01",
    "endDate": "2026-02-28"
  }
]
```

---

**End of Technical Design Document**

**Next Steps:**
1. Review and approve design with team
2. Create GitHub issues for all tasks
3. Assign tasks to team members
4. Start Sprint 1 implementation
5. Schedule daily standups

**Questions or clarifications needed?** Contact the development team.
