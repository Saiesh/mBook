# Project Management Module - Technical Summary

**Module:** Project Creation and Management  
**Version:** 1.0  
**Date:** February 15, 2026  

---

## 📋 Quick Overview

This document provides a high-level summary of the Project Management module design.

### Purpose
Enable users to create and manage construction projects, define project hierarchies (areas/zones), and assign team members.

### Key Features
1. ✅ Create, read, update, delete projects
2. ✅ Hierarchical area/zone management (2 levels)
3. ✅ Project team member assignment
4. ✅ Project search and filtering
5. ✅ Audit logging for all actions
6. ✅ Role-based access control

---

## 🗂️ Data Model Summary

### Core Entities

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **Project** | Main project entity | id, code, name, client, location, dates, status |
| **Area** | Hierarchical areas within project | id, project_id, code, name, parent_area_id, level |
| **ProjectTeamMember** | Project-user-role association | id, project_id, user_id, role |
| **User** | System users | id, email, name, role |
| **AuditLog** | Tracks all changes | id, entity_type, entity_id, action, user_id |

### Entity Relationships

```
User (1) ──creates──> (N) Project
Project (1) ──has──> (N) Area
Area (1) ──has──> (N) Area (self-referencing, parent-child)
Project (M) <──team──> (N) User (many-to-many via ProjectTeamMember)
User (1) ──performs──> (N) AuditLog
```

### Hierarchy Example

```
Project: "Sattva City"
├── Zone: "Marketing Office Drop Off" (level 1)
│   ├── Area: "Entrance" (level 2)
│   └── Area: "Parking" (level 2)
├── Zone: "Block A" (level 1)
│   ├── Area: "Floor 1" (level 2)
│   └── Area: "Floor 2" (level 2)
└── Zone: "Common Areas" (level 1)
    └── Area: "Lobby" (level 2)
```

---

## 🏗️ Architecture Overview

### Layered Architecture

```
┌─────────────────────────────────────┐
│     Frontend (React + MUI)          │  ← User Interface
├─────────────────────────────────────┤
│     API Layer (Express/FastAPI)     │  ← REST Endpoints
├─────────────────────────────────────┤
│     Service Layer                   │  ← Business Logic
├─────────────────────────────────────┤
│     Repository Layer                │  ← Data Access
├─────────────────────────────────────┤
│     Database (PostgreSQL 14+)       │  ← Data Storage
└─────────────────────────────────────┘
```

### Key Services

| Service | Responsibility |
|---------|----------------|
| **ProjectService** | Project CRUD, validation, authorization, stats |
| **AreaService** | Area CRUD, hierarchy building, reordering |
| **ProjectTeamService** | Team member assignment, removal |
| **AuditLogService** | Track all data changes |
| **ValidationService** | Input validation rules |

---

## 🔌 API Endpoints Summary

### Project Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/projects` | Create project | ✅ |
| GET | `/api/v1/projects/:id` | Get project details | ✅ |
| GET | `/api/v1/projects` | List projects (with filters) | ✅ |
| PUT | `/api/v1/projects/:id` | Update project | ✅ |
| DELETE | `/api/v1/projects/:id` | Delete project (soft) | ✅ Admin |
| GET | `/api/v1/projects/search` | Search projects | ✅ |

### Area Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/areas` | Create area | ✅ |
| GET | `/api/v1/projects/:id/areas` | List areas (flat) | ✅ |
| GET | `/api/v1/projects/:id/areas/hierarchy` | Get area tree | ✅ |
| PUT | `/api/v1/areas/:id` | Update area | ✅ |
| DELETE | `/api/v1/areas/:id` | Delete area (soft) | ✅ |
| PUT | `/api/v1/projects/:id/areas/reorder` | Reorder areas | ✅ |

### Team Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/projects/:id/team` | Add team member | ✅ |
| GET | `/api/v1/projects/:id/team` | List team members | ✅ |
| DELETE | `/api/v1/projects/:id/team/:userId` | Remove team member | ✅ |

**Total Endpoints:** 15

---

## 🔐 Security & Authorization

### Authentication
- JWT bearer tokens
- Token expiry: 24 hours
- Refresh tokens (future)

### Authorization Rules

| Action | Admin | HO QS | Site QS |
|--------|-------|-------|---------|
| Create Project | ✅ | ✅ | ❌ |
| View Project | ✅ All | ✅ Assigned | ✅ Assigned |
| Update Project | ✅ | ✅ | ❌ |
| Delete Project | ✅ | ❌ | ❌ |
| Create Area | ✅ | ✅ | ❌ |
| Update Area | ✅ | ✅ | ❌ |
| Delete Area | ✅ | ✅ | ❌ |
| Add Team Member | ✅ | ✅ | ❌ |

### Audit Logging
- All create/update/delete operations logged
- Tracks: who, what, when, before/after values
- Retention: permanent (for compliance)

---

## 💾 Database Design

### Tables Overview

| Table | Rows (est.) | Size (est.) | Indexes |
|-------|-------------|-------------|---------|
| users | 100 | < 1 MB | 3 |
| projects | 500 | 5 MB | 5 |
| areas | 5,000 | 10 MB | 4 |
| project_team_members | 1,500 | 2 MB | 3 |
| audit_logs | 50,000+ | 100+ MB | 4 |

### Key Indexes

```sql
-- Projects
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);

-- Areas
CREATE INDEX idx_areas_project_id ON areas(project_id);
CREATE INDEX idx_areas_parent_area_id ON areas(parent_area_id);
CREATE INDEX idx_areas_sort_order ON areas(project_id, sort_order);

-- Team Members
CREATE INDEX idx_project_team_project_id ON project_team_members(project_id);
CREATE INDEX idx_project_team_user_id ON project_team_members(user_id);

-- Audit Logs
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
```

---

## 🧪 Testing Strategy

### Test Coverage Targets

| Layer | Target | Type |
|-------|--------|------|
| Repository | >80% | Unit + Integration |
| Service | >80% | Unit + Integration |
| API | >90% | Integration + E2E |
| Frontend | >70% | Unit + Integration |

### Test Scenarios

**Unit Tests:**
- Repository CRUD operations
- Service business logic
- Validation rules
- Authorization checks

**Integration Tests:**
- API endpoints (all methods)
- Database queries
- Authentication/authorization
- Error handling

**E2E Tests:**
- Project creation flow
- Area management flow
- Team member management
- Search and filtering
- Authorization scenarios

---

## 📊 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Project list load time | < 500ms | 1000 projects, paginated |
| Project create | < 200ms | Including team members |
| Area hierarchy load | < 300ms | 100 areas |
| Search response | < 200ms | Full-text search |
| API response time (p95) | < 500ms | All endpoints |
| Database query time (p95) | < 100ms | Properly indexed |

### Optimization Strategies
1. **Database:** Proper indexing, query optimization
2. **API:** Pagination (default 20 items), response caching
3. **Frontend:** Lazy loading, debounced search, memoization

---

## 🚀 Implementation Plan

### Sprint 2 Timeline (2 weeks)

| Week | Phase | Focus |
|------|-------|-------|
| Week 1 | Phase 1-2 | Database + Repository Layer |
| Week 2 | Phase 3-4 | Service + API Layer |
| Week 3 | Phase 5 | Frontend (Part 1) |
| Week 4 | Phase 5-6 | Frontend (Part 2) + Testing + Docs |

### Task Breakdown

- **17 tasks** total
- **126 hours** estimated effort
- **2 developers** working full-time
- **4 weeks** duration (including buffer)

### Critical Path
```
Database → Repository → Service → API → Frontend → Testing
```

---

## 📦 Deliverables

### Code Deliverables
1. ✅ Database schema and migrations
2. ✅ Repository layer (3 repositories)
3. ✅ Service layer (2 services)
4. ✅ API layer (15 endpoints)
5. ✅ Frontend components (4 major components)
6. ✅ Unit tests (>80% coverage)
7. ✅ Integration tests (E2E scenarios)

### Documentation Deliverables
1. ✅ Technical design document
2. ✅ API documentation (Swagger)
3. ✅ User guide with screenshots
4. ✅ Developer guide
5. ✅ Video tutorials (3 videos)
6. ✅ FAQ document

### Testing Deliverables
1. ✅ Unit test suite
2. ✅ Integration test suite
3. ✅ E2E test suite
4. ✅ Test coverage report
5. ✅ Postman collection

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex hierarchical queries | Medium | Use recursive CTEs, test thoroughly |
| Database performance | Medium | Proper indexing, query optimization |
| Drag-and-drop complexity | Low | Use established library (dnd-kit) |
| Authorization bugs | High | Comprehensive test coverage |
| Team member availability | High | Good documentation, pair programming |

---

## 🔄 Future Enhancements (Post-MVP)

### Phase 2 Features
1. ⭐ Project templates
2. ⭐ Bulk area creation (import from Excel)
3. ⭐ Project duplication
4. ⭐ Advanced search (filters by date range, budget, location)
5. ⭐ Project archiving (vs deletion)
6. ⭐ Project timeline view (Gantt chart)
7. ⭐ Project dashboard (stats, charts)

### Phase 3 Features
1. ⭐ Multi-level area hierarchy (>2 levels)
2. ⭐ Area drawings/blueprints attachment
3. ⭐ Project cost tracking
4. ⭐ Project milestone tracking
5. ⭐ Email notifications (project updates)
6. ⭐ Project export (PDF report)

---

## 📞 Key Contacts

| Role | Responsibility | Contact |
|------|----------------|---------|
| Product Manager | Requirements, prioritization | TBD |
| Backend Lead | API, services, database | TBD |
| Frontend Lead | UI/UX, React components | TBD |
| QA Lead | Testing, quality assurance | TBD |
| DevOps | Infrastructure, deployment | TBD |

---

## 📚 Related Documents

1. [Technical Design Document](./TECHNICAL_DESIGN_PROJECT_MANAGEMENT.md) - Complete technical design
2. [Task Tracking Document](./PROJECT_MANAGEMENT_TASKS.md) - Detailed task breakdown
3. [Main PRD](./PRD_MVP.md) - Product requirements document
4. [Full PRD](./PRD_MEASUREMENT_BOOK.md) - Complete system PRD

---

## ✅ Success Criteria

### Functional Requirements
- ✅ Can create project with all required fields
- ✅ Can assign team members to project
- ✅ Can create hierarchical areas (zones → areas)
- ✅ Can search and filter projects
- ✅ Can edit and delete projects/areas
- ✅ Authorization rules enforced

### Non-Functional Requirements
- ✅ All API endpoints respond in < 500ms
- ✅ Database queries optimized with proper indexes
- ✅ Test coverage > 80%
- ✅ No critical security vulnerabilities
- ✅ Complete API documentation
- ✅ User guide with screenshots

### Acceptance Criteria
- ✅ 5 pilot users successfully create projects
- ✅ Can create project in < 5 minutes
- ✅ Can manage 100+ projects without performance issues
- ✅ Zero data loss incidents
- ✅ 95% uptime in production

---

## 🎯 Definition of Done

A task is considered "Done" when:

1. ✅ Code implemented and working
2. ✅ Unit tests written and passing (>80% coverage)
3. ✅ Integration tests written and passing
4. ✅ Code reviewed and approved
5. ✅ Documentation updated
6. ✅ No linting errors
7. ✅ Tested in dev environment
8. ✅ Merged to main branch
9. ✅ Deployed to staging
10. ✅ QA tested and approved

---

**Document Version:** 1.0  
**Last Updated:** February 15, 2026  
**Status:** Ready for Implementation

---

## Quick Links

- [View Full Technical Design →](./TECHNICAL_DESIGN_PROJECT_MANAGEMENT.md)
- [View Task Breakdown →](./PROJECT_MANAGEMENT_TASKS.md)
- [View Main PRD →](./PRD_MVP.md)
- [GitHub Repository →](#) _(Add link when available)_
- [API Documentation →](#) _(Add link when deployed)_
