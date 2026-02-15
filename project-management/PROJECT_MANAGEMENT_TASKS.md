# Project Management Module - Task Tracking

**Module:** Project Creation and Management  
**Sprint:** Sprint 2 (Weeks 3-4)  
**Status:** Planning Phase  
**Last Updated:** February 15, 2026

---

## Task Summary

| Phase | Total Tasks | Estimated Hours | Status |
|-------|-------------|-----------------|--------|
| Phase 1: Database Setup | 2 | 6h | Not Started |
| Phase 2: Repository Layer | 3 | 18h | Not Started |
| Phase 3: Service Layer | 2 | 20h | Not Started |
| Phase 4: API Layer | 3 | 22h | Not Started |
| Phase 5: Frontend | 4 | 42h | Not Started |
| Phase 6: Testing & Docs | 3 | 18h | Not Started |
| **TOTAL** | **17** | **126h** | **0% Complete** |

**Estimated Duration:** 2 weeks (2 developers working full-time)

---

## Phase 1: Database Setup (Week 1)

### Task 1.1: Database Schema Creation ✅
**Priority:** P0 - Must Have  
**Effort:** 4 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** None

**Description:**
Create complete PostgreSQL database schema for project management including users, projects, areas, team members, and audit logs.

**Checklist:**
- [ ] Create PostgreSQL database instance (development)
- [ ] Create `users` table with all columns and indexes
- [ ] Create `projects` table with all columns and indexes
- [ ] Create `project_team_members` table
- [ ] Create `areas` table with self-referencing FK
- [ ] Create `audit_logs` table
- [ ] Create ENUM types (user_role, project_status, team_member_role, audit_action)
- [ ] Create `update_updated_at_column()` function
- [ ] Create triggers for auto-updating timestamps
- [ ] Add all constraints and foreign keys
- [ ] Add check constraints (dates, levels)
- [ ] Test schema with sample INSERT/UPDATE/DELETE operations
- [ ] Verify indexes are created
- [ ] Test cascading deletes
- [ ] Document schema in README

**Acceptance Criteria:**
- ✅ All 5 tables created successfully
- ✅ All 15+ indexes created
- ✅ All foreign key constraints working
- ✅ Triggers auto-updating `updated_at` fields
- ✅ ENUM types enforcing valid values
- ✅ Check constraints preventing invalid data
- ✅ No errors in schema validation
- ✅ Can insert/update/delete test data

**Deliverables:**
- `database/schema.sql` - Complete schema definition
- `database/README.md` - Schema documentation

---

### Task 1.2: Database Migrations Setup ✅
**Priority:** P0 - Must Have  
**Effort:** 2 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 1.1

**Description:**
Setup database migration tool and create versioned migration scripts for schema changes.

**Checklist:**
- [ ] Choose migration tool (Flyway/Prisma Migrate/Alembic)
- [ ] Install and configure migration tool
- [ ] Create initial migration: `001_create_schema.sql`
- [ ] Test migration up (apply)
- [ ] Test migration down (rollback)
- [ ] Create seed data migration: `002_seed_data.sql`
- [ ] Document migration commands
- [ ] Add migration scripts to version control
- [ ] Setup CI/CD pipeline to run migrations
- [ ] Test migrations on fresh database

**Acceptance Criteria:**
- ✅ Migration tool configured
- ✅ Migrations run successfully (up and down)
- ✅ Rollback works correctly
- ✅ Seed data inserted
- ✅ Migration scripts versioned in Git
- ✅ CI/CD can run migrations automatically

**Deliverables:**
- `database/migrations/` - Migration scripts folder
- `database/MIGRATION_GUIDE.md` - How to run migrations

---

## Phase 2: Repository Layer (Week 1)

### Task 2.1: ProjectRepository Implementation ✅
**Priority:** P0 - Must Have  
**Effort:** 8 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 1.1

**Description:**
Implement data access layer for Project entity with full CRUD operations, pagination, filtering, and search.

**Checklist:**
- [ ] Create `IProjectRepository` interface
- [ ] Implement `ProjectRepository` class
- [ ] Implement `create(project)` method
- [ ] Implement `findById(id)` method with soft delete check
- [ ] Implement `findByCode(code)` method
- [ ] Implement `findAll(filters)` with pagination
  - [ ] Support `status` filter
  - [ ] Support `search` filter (name, code)
  - [ ] Support `createdBy` filter
  - [ ] Support date range filters
  - [ ] Support sorting (name, code, created_at, updated_at)
  - [ ] Support pagination (page, limit)
- [ ] Implement `update(id, updates)` method
- [ ] Implement `softDelete(id)` method (set deleted_at)
- [ ] Implement `exists(code)` method for uniqueness check
- [ ] Write unit tests for all methods (>80% coverage)
  - [ ] Test create
  - [ ] Test findById (found, not found, soft deleted)
  - [ ] Test findAll with various filters
  - [ ] Test pagination
  - [ ] Test update
  - [ ] Test soft delete
- [ ] Test with real PostgreSQL database
- [ ] Handle database errors gracefully
- [ ] Add query logging for debugging

**Acceptance Criteria:**
- ✅ All 8 methods implemented
- ✅ CRUD operations working correctly
- ✅ Pagination returning correct results
- ✅ Filters working (status, search, dates)
- ✅ Sorting working (asc/desc)
- ✅ Soft delete implemented (deleted_at timestamp)
- ✅ Unit tests passing with >80% coverage
- ✅ Integration tests with PostgreSQL passing

**Deliverables:**
- `repositories/IProjectRepository.ts` - Interface
- `repositories/ProjectRepository.ts` - Implementation
- `repositories/__tests__/ProjectRepository.test.ts` - Tests

---

### Task 2.2: AreaRepository Implementation ✅
**Priority:** P0 - Must Have  
**Effort:** 6 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 1.1

**Description:**
Implement data access layer for Area entity with hierarchical queries for parent-child relationships.

**Checklist:**
- [ ] Create `IAreaRepository` interface
- [ ] Implement `AreaRepository` class
- [ ] Implement `create(area)` method
- [ ] Implement `findById(id)` method
- [ ] Implement `findByProjectId(projectId)` method
- [ ] Implement `findByCode(projectId, code)` method
- [ ] Implement `update(id, updates)` method
- [ ] Implement `softDelete(id)` method
- [ ] Implement `getHierarchy(projectId)` method
  - [ ] Use recursive CTE or multiple queries
  - [ ] Return tree structure (zones with child areas)
  - [ ] Sort by `sort_order`
- [ ] Write unit tests for all methods
  - [ ] Test hierarchical queries
  - [ ] Test parent-child relationships
  - [ ] Test sorting
- [ ] Test with real PostgreSQL

**Acceptance Criteria:**
- ✅ All 8 methods implemented
- ✅ CRUD operations working
- ✅ Hierarchical queries working correctly
- ✅ Parent-child relationships maintained
- ✅ Tree structure built correctly
- ✅ Areas sorted by sort_order
- ✅ Unit tests passing

**Deliverables:**
- `repositories/IAreaRepository.ts` - Interface
- `repositories/AreaRepository.ts` - Implementation
- `repositories/__tests__/AreaRepository.test.ts` - Tests

---

### Task 2.3: ProjectTeamRepository Implementation ✅
**Priority:** P0 - Must Have  
**Effort:** 4 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 1.1

**Description:**
Implement data access layer for project team member assignments.

**Checklist:**
- [ ] Create `IProjectTeamRepository` interface
- [ ] Implement `ProjectTeamRepository` class
- [ ] Implement `addMember(projectId, userId, role)` method
- [ ] Implement `removeMember(projectId, userId, role)` method (set removed_at)
- [ ] Implement `getTeamMembers(projectId)` method
  - [ ] Join with users table
  - [ ] Return user details with role
- [ ] Implement `getUserProjects(userId)` method
  - [ ] Join with projects table
  - [ ] Return projects where user is member
- [ ] Implement `isMember(projectId, userId)` method for authorization
- [ ] Write unit tests
- [ ] Test with real PostgreSQL

**Acceptance Criteria:**
- ✅ All 5 methods implemented
- ✅ Can add/remove team members
- ✅ Can query team by project (with user details)
- ✅ Can query projects by user
- ✅ Can check membership for authorization
- ✅ UNIQUE constraint enforced (project, user, role)
- ✅ Unit tests passing

**Deliverables:**
- `repositories/IProjectTeamRepository.ts` - Interface
- `repositories/ProjectTeamRepository.ts` - Implementation
- `repositories/__tests__/ProjectTeamRepository.test.ts` - Tests

---

## Phase 3: Service Layer (Week 2)

### Task 3.1: ProjectService Implementation ✅
**Priority:** P0 - Must Have  
**Effort:** 12 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 2.1, Task 2.3

**Description:**
Implement business logic layer for project management with validation, authorization, and audit logging.

**Checklist:**
- [ ] Create `IProjectService` interface
- [ ] Implement `ProjectService` class
- [ ] Implement `createProject(data, userId)` method
  - [ ] Validate all required fields
  - [ ] Validate project code format (uppercase, alphanumeric, hyphens)
  - [ ] Check code uniqueness
  - [ ] Validate date range (end > start)
  - [ ] Create project
  - [ ] Add team members if provided
  - [ ] Create audit log
- [ ] Implement `getProject(id, userId)` method
  - [ ] Check project exists and not deleted
  - [ ] Check user has access (is member or admin)
  - [ ] Fetch team members
  - [ ] Fetch areas
  - [ ] Calculate stats (counts, totals)
- [ ] Implement `listProjects(filters, userId)` method
  - [ ] Apply user-specific filters (non-admins see only their projects)
  - [ ] Apply status filter
  - [ ] Apply search filter (name, code)
  - [ ] Apply pagination
  - [ ] Return paginated results
- [ ] Implement `updateProject(id, data, userId)` method
  - [ ] Check project exists
  - [ ] Check permission (only HO QS or admin)
  - [ ] Validate updates
  - [ ] Update project
  - [ ] Create audit log
- [ ] Implement `deleteProject(id, userId)` method
  - [ ] Check project exists
  - [ ] Check permission (only admin)
  - [ ] Check no active bills (prevent deletion)
  - [ ] Soft delete project
  - [ ] Create audit log
- [ ] Implement `searchProjects(query, userId)` method
  - [ ] Search by name or code (ILIKE)
  - [ ] Limit to 20 results
- [ ] Implement `getProjectStats(id)` helper
  - [ ] Count areas
  - [ ] Count BOQ items
  - [ ] Count measurements
  - [ ] Count bills
  - [ ] Sum bill amounts
- [ ] Write unit tests (mock repositories)
  - [ ] Test create project (success, validation errors, duplicate code)
  - [ ] Test get project (found, not found, no access)
  - [ ] Test list projects (admin vs non-admin)
  - [ ] Test update project (success, no permission)
  - [ ] Test delete project (success, no permission, has bills)
  - [ ] Test search
- [ ] Write integration tests (real DB)

**Acceptance Criteria:**
- ✅ All methods implemented
- ✅ Business logic working correctly
- ✅ Validation rules enforced
- ✅ Authorization checks working (RBAC)
- ✅ Audit logging functional for all actions
- ✅ Unit tests passing with >80% coverage
- ✅ Integration tests passing

**Deliverables:**
- `services/IProjectService.ts` - Interface
- `services/ProjectService.ts` - Implementation
- `services/__tests__/ProjectService.test.ts` - Tests

---

### Task 3.2: AreaService Implementation ✅
**Priority:** P0 - Must Have  
**Effort:** 8 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 2.2

**Description:**
Implement business logic layer for area management with hierarchy support.

**Checklist:**
- [ ] Create `IAreaService` interface
- [ ] Implement `AreaService` class
- [ ] Implement `createArea(data, userId)` method
  - [ ] Validate project exists
  - [ ] Validate code format
  - [ ] Check code uniqueness within project
  - [ ] Validate parent area (if provided)
    - [ ] Parent must be in same project
    - [ ] Parent must be level 1 (zone)
  - [ ] Determine level (1 if no parent, 2 if parent)
  - [ ] Create area
  - [ ] Create audit log
- [ ] Implement `getArea(id)` method
- [ ] Implement `listAreas(projectId)` method
  - [ ] Return flat list of areas
  - [ ] Sort by sort_order
- [ ] Implement `getAreaHierarchy(projectId)` method
  - [ ] Fetch all areas
  - [ ] Build tree structure (zones with children)
  - [ ] Sort by sort_order at each level
- [ ] Implement `updateArea(id, data, userId)` method
  - [ ] Check area exists
  - [ ] Validate updates
  - [ ] Update area
  - [ ] Create audit log
- [ ] Implement `deleteArea(id, userId)` method
  - [ ] Check area exists
  - [ ] Check no measurements (prevent deletion)
  - [ ] Check no BOQ mappings (prevent deletion)
  - [ ] Check no child areas (prevent deletion)
  - [ ] Soft delete area
  - [ ] Create audit log
- [ ] Implement `reorderAreas(projectId, areaIds)` method
  - [ ] Update sort_order for each area
  - [ ] Maintain order
- [ ] Write unit tests
  - [ ] Test create area (success, invalid parent, duplicate code)
  - [ ] Test hierarchy building
  - [ ] Test reordering
  - [ ] Test delete (success, has children, has measurements)
- [ ] Write integration tests

**Acceptance Criteria:**
- ✅ All area operations working
- ✅ Hierarchy building correct (2 levels max)
- ✅ Parent-child relationships enforced
- ✅ Reordering functional
- ✅ Cannot delete areas with children or measurements
- ✅ Audit logging working
- ✅ Tests passing with >80% coverage

**Deliverables:**
- `services/IAreaService.ts` - Interface
- `services/AreaService.ts` - Implementation
- `services/__tests__/AreaService.test.ts` - Tests

---

## Phase 4: API Layer (Week 2-3)

### Task 4.1: Project API Endpoints ✅
**Priority:** P0 - Must Have  
**Effort:** 10 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 3.1

**Description:**
Implement REST API endpoints for project management with authentication and validation.

**Checklist:**
- [ ] Setup Express.js/FastAPI router for `/api/v1/projects`
- [ ] Implement `POST /api/v1/projects` endpoint
  - [ ] Add authentication middleware
  - [ ] Add request validation (Joi/Pydantic)
  - [ ] Call `ProjectService.createProject()`
  - [ ] Return 201 Created with project data
  - [ ] Handle errors (400, 401, 409)
- [ ] Implement `GET /api/v1/projects/:id` endpoint
  - [ ] Authenticate
  - [ ] Call `ProjectService.getProject()`
  - [ ] Return 200 OK with project details
  - [ ] Handle errors (404, 403)
- [ ] Implement `GET /api/v1/projects` endpoint
  - [ ] Authenticate
  - [ ] Parse query params (status, search, page, limit, sortBy, sortOrder)
  - [ ] Call `ProjectService.listProjects()`
  - [ ] Return 200 OK with paginated results
- [ ] Implement `PUT /api/v1/projects/:id` endpoint
  - [ ] Authenticate
  - [ ] Validate request body
  - [ ] Call `ProjectService.updateProject()`
  - [ ] Return 200 OK with updated project
  - [ ] Handle errors (400, 404, 403)
- [ ] Implement `DELETE /api/v1/projects/:id` endpoint
  - [ ] Authenticate
  - [ ] Call `ProjectService.deleteProject()`
  - [ ] Return 204 No Content
  - [ ] Handle errors (404, 403, 409)
- [ ] Implement `GET /api/v1/projects/search` endpoint
  - [ ] Authenticate
  - [ ] Parse query param `q`
  - [ ] Call `ProjectService.searchProjects()`
  - [ ] Return 200 OK with results
- [ ] Add global error handler middleware
- [ ] Add request logging middleware
- [ ] Write API tests (Supertest/pytest)
  - [ ] Test all endpoints with valid data
  - [ ] Test authentication (missing token, invalid token)
  - [ ] Test authorization (no access)
  - [ ] Test validation errors
  - [ ] Test not found errors
- [ ] Create Postman collection

**Acceptance Criteria:**
- ✅ All 6 endpoints working
- ✅ Request validation working (400 errors)
- ✅ Authentication required (401 errors)
- ✅ Authorization enforced (403 errors)
- ✅ Proper HTTP status codes
- ✅ Error responses in standard format
- ✅ API tests passing
- ✅ Postman collection created

**Deliverables:**
- `routes/projects.ts` - Route definitions
- `controllers/ProjectController.ts` - Controller logic
- `middleware/auth.ts` - Authentication middleware
- `middleware/validation.ts` - Validation middleware
- `__tests__/api/projects.test.ts` - API tests
- `postman/project-management.json` - Postman collection

---

### Task 4.2: Area API Endpoints ✅
**Priority:** P0 - Must Have  
**Effort:** 8 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 3.2

**Description:**
Implement REST API endpoints for area management.

**Checklist:**
- [ ] Setup router for `/api/v1/areas`
- [ ] Implement `POST /api/v1/areas` endpoint
  - [ ] Authenticate
  - [ ] Validate request
  - [ ] Call `AreaService.createArea()`
  - [ ] Return 201 Created
- [ ] Implement `GET /api/v1/projects/:projectId/areas` endpoint
  - [ ] Authenticate
  - [ ] Call `AreaService.listAreas()`
  - [ ] Return 200 OK with flat list
- [ ] Implement `GET /api/v1/projects/:projectId/areas/hierarchy` endpoint
  - [ ] Authenticate
  - [ ] Call `AreaService.getAreaHierarchy()`
  - [ ] Return 200 OK with tree structure
- [ ] Implement `PUT /api/v1/areas/:id` endpoint
  - [ ] Authenticate
  - [ ] Validate request
  - [ ] Call `AreaService.updateArea()`
  - [ ] Return 200 OK
- [ ] Implement `DELETE /api/v1/areas/:id` endpoint
  - [ ] Authenticate
  - [ ] Call `AreaService.deleteArea()`
  - [ ] Return 204 No Content
  - [ ] Handle 409 if has children/measurements
- [ ] Implement `PUT /api/v1/projects/:projectId/areas/reorder` endpoint
  - [ ] Authenticate
  - [ ] Validate areaIds array
  - [ ] Call `AreaService.reorderAreas()`
  - [ ] Return 200 OK
- [ ] Add middleware
- [ ] Write API tests
- [ ] Add to Postman collection

**Acceptance Criteria:**
- ✅ All 6 endpoints working
- ✅ Hierarchy endpoint returns tree structure
- ✅ Reordering updates sort_order correctly
- ✅ Cannot delete areas with children
- ✅ API tests passing
- ✅ Postman collection updated

**Deliverables:**
- `routes/areas.ts` - Route definitions
- `controllers/AreaController.ts` - Controller logic
- `__tests__/api/areas.test.ts` - API tests

---

### Task 4.3: Project Team API Endpoints ✅
**Priority:** P0 - Must Have  
**Effort:** 4 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 3.1

**Description:**
Implement REST API endpoints for project team member management.

**Checklist:**
- [ ] Implement `POST /api/v1/projects/:projectId/team` endpoint
  - [ ] Authenticate
  - [ ] Validate request (userId, role)
  - [ ] Call `ProjectService.addTeamMember()`
  - [ ] Return 201 Created
- [ ] Implement `GET /api/v1/projects/:projectId/team` endpoint
  - [ ] Authenticate
  - [ ] Call `ProjectService.getTeamMembers()`
  - [ ] Return 200 OK with team members (with user details)
- [ ] Implement `DELETE /api/v1/projects/:projectId/team/:userId` endpoint
  - [ ] Authenticate
  - [ ] Call `ProjectService.removeTeamMember()`
  - [ ] Return 204 No Content
- [ ] Add middleware
- [ ] Write API tests
- [ ] Add to Postman collection

**Acceptance Criteria:**
- ✅ All 3 endpoints working
- ✅ Can add/remove team members
- ✅ Team list includes user details
- ✅ API tests passing
- ✅ Postman collection updated

**Deliverables:**
- `routes/project-team.ts` - Route definitions
- `__tests__/api/project-team.test.ts` - API tests

---

## Phase 5: Frontend Implementation (Week 3-4)

### Task 5.1: Project List Page ✅
**Priority:** P0 - Must Have  
**Effort:** 8 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 4.1

**Description:**
Create React component for listing projects with search, filtering, and pagination.

**Checklist:**
- [ ] Create `ProjectList.tsx` component
- [ ] Setup Redux slice for projects
  - [ ] Actions: fetchProjects, searchProjects, setFilters
  - [ ] Reducer: manage projects state, loading, error
- [ ] Implement project table using Material-UI DataGrid
  - [ ] Columns: Code, Name, Client, Status, Created Date
  - [ ] Actions column: View, Edit buttons
- [ ] Add search input (debounced, 300ms)
- [ ] Add status filter dropdown (All, Active, Completed, On Hold)
- [ ] Add sorting (click column headers)
- [ ] Add pagination controls (Material-UI Pagination)
- [ ] Connect to API via Axios
  - [ ] GET /api/v1/projects
  - [ ] Handle loading state (show spinner)
  - [ ] Handle error state (show error message)
- [ ] Add "Create New Project" button (routes to create page)
- [ ] Style with Material-UI theme
- [ ] Make responsive (mobile-friendly)
- [ ] Write component tests (React Testing Library)
  - [ ] Test rendering
  - [ ] Test search
  - [ ] Test filtering
  - [ ] Test pagination
- [ ] Write integration tests with mock API

**Acceptance Criteria:**
- ✅ Project list displays correctly in table
- ✅ Pagination working (prev/next, page numbers)
- ✅ Search working (filters by name or code)
- ✅ Status filter working
- ✅ Sorting working (by name, code, date)
- ✅ API integration working
- ✅ Loading spinner shown during fetch
- ✅ Error message shown on failure
- ✅ Component tests passing
- ✅ Responsive on mobile

**Deliverables:**
- `components/projects/ProjectList.tsx` - Component
- `store/slices/projectsSlice.ts` - Redux slice
- `__tests__/components/ProjectList.test.tsx` - Tests
- `services/api/projectsApi.ts` - API client

---

### Task 5.2: Create/Edit Project Form ✅
**Priority:** P0 - Must Have  
**Effort:** 12 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 4.1

**Description:**
Create React form component for creating and editing projects.

**Checklist:**
- [ ] Create `ProjectForm.tsx` component
- [ ] Use React Hook Form for form state management
- [ ] Add form fields:
  - [ ] Project Name (text, required, min 3 chars)
  - [ ] Project Code (text, required, uppercase, alphanumeric + hyphens)
  - [ ] Client Name (text, optional)
  - [ ] Location - City (text, optional)
  - [ ] Location - State (text, optional)
  - [ ] Location - Address (textarea, optional)
  - [ ] Start Date (date picker)
  - [ ] End Date (date picker, must be after start date)
  - [ ] Description (textarea, optional)
  - [ ] Budget (number, optional)
- [ ] Add team member selector
  - [ ] Multi-select dropdown (fetch users from API)
  - [ ] Select role for each user (HO QS, Site QS, Project In-charge)
  - [ ] Show selected team members as chips
  - [ ] Allow removing team members
- [ ] Implement client-side validation
  - [ ] Required field validation
  - [ ] Project code format validation (regex)
  - [ ] Date range validation (end > start)
  - [ ] Budget validation (positive number)
- [ ] Handle form submission
  - [ ] Call POST /api/v1/projects (create mode)
  - [ ] Call PUT /api/v1/projects/:id (edit mode)
  - [ ] Show loading spinner during submission
  - [ ] Handle success (show toast, redirect to project details)
  - [ ] Handle errors (show validation errors, show API errors)
- [ ] Support create and edit modes
  - [ ] Create mode: empty form
  - [ ] Edit mode: pre-fill form with existing data
- [ ] Add "Cancel" button (goes back)
- [ ] Add "Save" button (submits form)
- [ ] Style form with Material-UI
- [ ] Make responsive
- [ ] Write component tests
  - [ ] Test rendering
  - [ ] Test validation
  - [ ] Test submission (success, error)
  - [ ] Test create vs edit mode

**Acceptance Criteria:**
- ✅ Form validates inputs client-side
- ✅ Can create new project successfully
- ✅ Can edit existing project successfully
- ✅ Team members can be added/removed
- ✅ Team member roles can be selected
- ✅ Date picker working
- ✅ Success notification shown after save
- ✅ Error messages shown for validation/API errors
- ✅ Form disabled during submission
- ✅ Cancel button works
- ✅ Component tests passing

**Deliverables:**
- `components/projects/ProjectForm.tsx` - Form component
- `components/projects/TeamMemberSelector.tsx` - Team selector component
- `__tests__/components/ProjectForm.test.tsx` - Tests

---

### Task 5.3: Project Details Page ✅
**Priority:** P0 - Must Have  
**Effort:** 10 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 4.1, Task 4.2

**Description:**
Create React page for displaying project details with team, areas, and stats.

**Checklist:**
- [ ] Create `ProjectDetails.tsx` page component
- [ ] Fetch project data on mount
  - [ ] GET /api/v1/projects/:id
  - [ ] Handle loading state
  - [ ] Handle not found (404)
  - [ ] Handle no access (403)
- [ ] Display project information
  - [ ] Project name and code (header)
  - [ ] Status badge (color-coded)
  - [ ] Client name
  - [ ] Location (city, state)
  - [ ] Start and end dates
  - [ ] Description
  - [ ] Budget (formatted as currency)
- [ ] Display team members section
  - [ ] Table with: Name, Email, Role, Assigned Date
  - [ ] "Add Team Member" button
  - [ ] Remove button for each member
- [ ] Display areas section
  - [ ] Hierarchical tree view (zones → areas)
  - [ ] "Create Area" button
  - [ ] Edit/delete buttons for each area
- [ ] Display project stats
  - [ ] Total areas count
  - [ ] Total BOQ items count
  - [ ] Total measurements count
  - [ ] Total bills count
  - [ ] Total amount (formatted)
- [ ] Add action buttons
  - [ ] "Edit Project" button (routes to edit form)
  - [ ] "Delete Project" button (with confirmation dialog)
  - [ ] "Upload BOQ" button (future feature)
  - [ ] "Generate Bill" button (future feature)
- [ ] Add tabs for different views
  - [ ] Overview tab (default)
  - [ ] Team tab
  - [ ] Areas tab
  - [ ] Measurements tab (future)
  - [ ] Bills tab (future)
- [ ] Style with Material-UI
- [ ] Make responsive
- [ ] Write component tests

**Acceptance Criteria:**
- ✅ Project details display correctly
- ✅ Team members shown with roles
- ✅ Areas shown in tree structure
- ✅ Stats calculated correctly
- ✅ Edit button works
- ✅ Delete button shows confirmation
- ✅ Tabs switch between views
- ✅ 404 shown if project not found
- ✅ 403 shown if no access
- ✅ Component tests passing

**Deliverables:**
- `pages/ProjectDetails.tsx` - Page component
- `components/projects/ProjectInfo.tsx` - Info display
- `components/projects/TeamMemberList.tsx` - Team list
- `components/projects/AreaTree.tsx` - Area tree
- `components/projects/ProjectStats.tsx` - Stats display
- `__tests__/pages/ProjectDetails.test.tsx` - Tests

---

### Task 5.4: Area Management UI ✅
**Priority:** P0 - Must Have  
**Effort:** 12 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 4.2

**Description:**
Create React components for managing areas with hierarchical tree view and drag-and-drop reordering.

**Checklist:**
- [ ] Create `AreaManagement.tsx` component
- [ ] Fetch areas on mount
  - [ ] GET /api/v1/projects/:projectId/areas/hierarchy
- [ ] Display areas in tree structure
  - [ ] Use Material-UI TreeView component
  - [ ] Show zones (level 1) as parent nodes
  - [ ] Show areas (level 2) as child nodes
  - [ ] Show area code and name
  - [ ] Expand/collapse zones
- [ ] Create `AreaFormDialog.tsx` for create/edit
  - [ ] Modal dialog
  - [ ] Fields: Code, Name, Description, Parent Area (dropdown)
  - [ ] Validation (required fields, code format)
  - [ ] Submit to POST /api/v1/areas or PUT /api/v1/areas/:id
- [ ] Add "Create Zone" button (parent = null)
- [ ] Add "Create Area" button for each zone (parent = zone)
- [ ] Add edit button for each area/zone (opens dialog)
- [ ] Add delete button for each area/zone
  - [ ] Show confirmation dialog
  - [ ] Call DELETE /api/v1/areas/:id
  - [ ] Handle error if area has children or measurements
- [ ] Implement drag-and-drop reordering
  - [ ] Use react-beautiful-dnd or dnd-kit
  - [ ] Allow dragging zones to reorder
  - [ ] Allow dragging areas within same zone to reorder
  - [ ] Prevent dragging area to different zone (future feature)
  - [ ] Call PUT /api/v1/projects/:projectId/areas/reorder on drop
- [ ] Handle loading, error states
- [ ] Style with Material-UI
- [ ] Write component tests
  - [ ] Test tree rendering
  - [ ] Test create/edit/delete
  - [ ] Test drag-and-drop

**Acceptance Criteria:**
- ✅ Areas display in hierarchical tree
- ✅ Can expand/collapse zones
- ✅ Can create zones (level 1)
- ✅ Can create areas under zones (level 2)
- ✅ Can edit area/zone
- ✅ Can delete area/zone (with confirmation)
- ✅ Error shown if delete fails (has children/measurements)
- ✅ Drag-and-drop reordering works
- ✅ Reorder saved to server
- ✅ Tree updates after any action
- ✅ Component tests passing

**Deliverables:**
- `components/areas/AreaManagement.tsx` - Main component
- `components/areas/AreaTree.tsx` - Tree view
- `components/areas/AreaFormDialog.tsx` - Create/edit dialog
- `components/areas/AreaNode.tsx` - Tree node
- `__tests__/components/AreaManagement.test.tsx` - Tests

---

## Phase 6: Testing & Documentation (Week 4)

### Task 6.1: Integration Testing ✅
**Priority:** P1 - Should Have  
**Effort:** 8 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** All previous tasks

**Description:**
Write comprehensive end-to-end integration tests covering complete user flows.

**Checklist:**
- [ ] Setup E2E test environment
  - [ ] Setup test database
  - [ ] Setup test server
  - [ ] Setup test data seeding
- [ ] Write E2E test: Project creation flow
  - [ ] Login as HO QS
  - [ ] Navigate to create project
  - [ ] Fill form with valid data
  - [ ] Submit form
  - [ ] Verify project created in DB
  - [ ] Verify redirect to project details
- [ ] Write E2E test: Project listing and search
  - [ ] Create multiple test projects
  - [ ] Navigate to project list
  - [ ] Test search functionality
  - [ ] Test status filter
  - [ ] Test pagination
- [ ] Write E2E test: Project update flow
  - [ ] Login as HO QS
  - [ ] Open existing project
  - [ ] Click edit
  - [ ] Update fields
  - [ ] Submit
  - [ ] Verify updates saved
- [ ] Write E2E test: Area management flow
  - [ ] Create zone
  - [ ] Create area under zone
  - [ ] Edit area
  - [ ] Reorder areas
  - [ ] Delete area
  - [ ] Verify DB changes
- [ ] Write E2E test: Team member management
  - [ ] Add team member
  - [ ] Remove team member
  - [ ] Verify changes
- [ ] Write E2E test: Authorization scenarios
  - [ ] Test Site QS cannot edit project
  - [ ] Test Site QS cannot delete project
  - [ ] Test non-member cannot view project
  - [ ] Test admin can view all projects
- [ ] Write E2E test: Error scenarios
  - [ ] Test duplicate project code
  - [ ] Test invalid date range
  - [ ] Test delete project with bills
  - [ ] Test delete area with measurements
- [ ] Document test scenarios
- [ ] Run tests in CI/CD

**Acceptance Criteria:**
- ✅ All integration tests passing
- ✅ Edge cases covered
- ✅ Error scenarios tested
- ✅ Authorization tested
- ✅ Tests can run in CI/CD
- ✅ Test coverage report generated

**Deliverables:**
- `__tests__/e2e/project-management.test.ts` - E2E tests
- `__tests__/fixtures/` - Test data fixtures
- `docs/TESTING.md` - Testing documentation

---

### Task 6.2: API Documentation ✅
**Priority:** P1 - Should Have  
**Effort:** 4 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 4.1, Task 4.2, Task 4.3

**Description:**
Create comprehensive API documentation using Swagger/OpenAPI.

**Checklist:**
- [ ] Install Swagger/OpenAPI dependencies
- [ ] Configure Swagger in Express/FastAPI
- [ ] Document authentication
  - [ ] JWT bearer token
  - [ ] Login endpoint
- [ ] Document all project endpoints
  - [ ] POST /api/v1/projects
  - [ ] GET /api/v1/projects/:id
  - [ ] GET /api/v1/projects
  - [ ] PUT /api/v1/projects/:id
  - [ ] DELETE /api/v1/projects/:id
  - [ ] GET /api/v1/projects/search
- [ ] Document all area endpoints (6 endpoints)
- [ ] Document all team endpoints (3 endpoints)
- [ ] For each endpoint, add:
  - [ ] Description
  - [ ] Request parameters (path, query, body)
  - [ ] Request body schema (with examples)
  - [ ] Response schemas (200, 400, 401, 403, 404, 409)
  - [ ] Response examples (success and error)
- [ ] Document error codes
  - [ ] VALIDATION_ERROR
  - [ ] NOT_FOUND
  - [ ] UNAUTHORIZED
  - [ ] FORBIDDEN
  - [ ] CONFLICT
  - [ ] INTERNAL_ERROR
- [ ] Generate API docs at `/api/docs`
- [ ] Test all examples in Swagger UI
- [ ] Export OpenAPI spec to JSON/YAML

**Acceptance Criteria:**
- ✅ Complete API documentation accessible at /api/docs
- ✅ All endpoints documented with examples
- ✅ Request/response schemas defined
- ✅ Error responses documented
- ✅ Can test endpoints directly from Swagger UI
- ✅ OpenAPI spec exported

**Deliverables:**
- `swagger.yaml` or `swagger.json` - OpenAPI spec
- `/api/docs` - Swagger UI endpoint
- `docs/API.md` - Additional API documentation

---

### Task 6.3: User Documentation ✅
**Priority:** P1 - Should Have  
**Effort:** 6 hours  
**Assignee:** _Unassigned_  
**Status:** 🔴 Not Started  
**Dependencies:** Task 5.1, Task 5.2, Task 5.3, Task 5.4

**Description:**
Create user-facing documentation with guides, screenshots, and video tutorials.

**Checklist:**
- [ ] Create user guide for project creation
  - [ ] Step-by-step instructions
  - [ ] Screenshots of each step
  - [ ] Common issues and solutions
- [ ] Create user guide for project management
  - [ ] How to edit project
  - [ ] How to change status
  - [ ] How to add team members
  - [ ] How to delete project
- [ ] Create user guide for area management
  - [ ] How to create zones
  - [ ] How to create areas under zones
  - [ ] How to edit/delete areas
  - [ ] How to reorder areas
- [ ] Create quick reference guide
  - [ ] One-page cheat sheet
  - [ ] Common tasks
  - [ ] Keyboard shortcuts
- [ ] Record video tutorials
  - [ ] Video 1: Creating a project (5 min)
  - [ ] Video 2: Managing areas (5 min)
  - [ ] Video 3: Adding team members (3 min)
- [ ] Create FAQ document
  - [ ] Common questions
  - [ ] Troubleshooting
- [ ] Create README for developers
  - [ ] Setup instructions
  - [ ] Development workflow
  - [ ] Testing instructions
- [ ] Organize in `docs/` folder
- [ ] Link from main README

**Acceptance Criteria:**
- ✅ User guides complete with screenshots
- ✅ Video tutorials recorded and uploaded
- ✅ FAQ document created
- ✅ Developer README created
- ✅ All docs linked from main README

**Deliverables:**
- `docs/USER_GUIDE.md` - Complete user guide
- `docs/QUICK_REFERENCE.md` - Quick reference
- `docs/FAQ.md` - Frequently asked questions
- `docs/DEVELOPER_GUIDE.md` - Developer documentation
- `docs/videos/` - Video tutorials
- `docs/screenshots/` - Screenshots

---

## Risk Tracking

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| Database schema changes | Medium | High | Use migrations, version schema | 🟡 Monitor |
| API performance with large datasets | Medium | Medium | Implement pagination, optimize queries | 🟡 Monitor |
| Complex hierarchical queries (areas) | Low | Medium | Test thoroughly, use recursive CTEs | 🟢 Low Risk |
| Frontend state management complexity | Medium | Low | Use Redux, test thoroughly | 🟢 Low Risk |
| Drag-and-drop implementation | Medium | Low | Use established library (dnd-kit) | 🟢 Low Risk |
| Team member availability | Low | High | Document well, pair programming | 🟢 Low Risk |

---

## Dependencies

**External Dependencies:**
- PostgreSQL 14+ (database)
- Node.js 18+ or Python 3.10+ (backend)
- React 18+ (frontend)
- Material-UI 5+ (UI components)
- JWT library (authentication)
- Excel library - ExcelJS or openpyxl (for future BOQ upload)

**Internal Dependencies:**
- User authentication system (from Sprint 1)
- User management APIs (from Sprint 1)

---

## Next Steps

1. **Kick-off Meeting**
   - Review tasks with team
   - Assign tasks to developers
   - Clarify any questions

2. **Sprint Planning**
   - Create GitHub issues for all tasks
   - Add to project board
   - Set up milestones

3. **Development Environment**
   - Ensure all developers have access to:
     - Database (dev instance)
     - GitHub repository
     - CI/CD pipeline
     - Documentation

4. **Daily Standups**
   - 15-minute daily sync
   - Discuss progress, blockers
   - Update task status

5. **Weekly Reviews**
   - Demo completed work
   - Review code quality
   - Adjust plan if needed

---

**Last Updated:** February 15, 2026  
**Next Review:** Start of Sprint 2 (Week 3)
