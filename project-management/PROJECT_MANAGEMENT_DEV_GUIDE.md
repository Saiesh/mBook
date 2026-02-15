# Project Management Module - Developer Quick Reference

**Quick reference for developers implementing the Project Management module**

---

## 🚀 Quick Start

### Prerequisites
```bash
# Required software
- PostgreSQL 14+
- Node.js 18+ OR Python 3.10+
- Git
- VS Code (recommended)

# Environment setup
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup
```bash
# Create database
createdb mbook_dev

# Run migrations
npm run migrate:up
# OR
python manage.py migrate

# Seed test data
npm run seed
# OR
python manage.py seed
```

### Run Development Server
```bash
# Backend
npm run dev
# OR
python manage.py runserver

# Frontend
cd frontend
npm run dev

# Access
Frontend: http://localhost:3000
Backend API: http://localhost:8000
API Docs: http://localhost:8000/api/docs
```

---

## 📁 Project Structure

```
mbook/
├── backend/
│   ├── src/
│   │   ├── controllers/          # HTTP request handlers
│   │   ├── services/              # Business logic
│   │   ├── repositories/          # Data access layer
│   │   ├── models/                # TypeScript types / Python models
│   │   ├── middleware/            # Auth, validation, etc.
│   │   ├── routes/                # API route definitions
│   │   └── utils/                 # Helper functions
│   ├── database/
│   │   ├── migrations/            # Database migrations
│   │   ├── seeds/                 # Test data
│   │   └── schema.sql             # Complete schema
│   └── tests/
│       ├── unit/                  # Unit tests
│       ├── integration/           # Integration tests
│       └── e2e/                   # End-to-end tests
│
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── projects/
│   │   │   └── areas/
│   │   ├── pages/                 # Page components
│   │   ├── store/                 # Redux store
│   │   ├── services/              # API clients
│   │   └── utils/                 # Helper functions
│   └── tests/
│
└── docs/                          # Documentation
```

---

## 🗄️ Database Quick Reference

### Connection String
```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/mbook_dev
```

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | System users | id, email, role |
| `projects` | Projects | id, code, name, status |
| `areas` | Zones/Areas | id, project_id, parent_area_id, level |
| `project_team_members` | Team assignments | project_id, user_id, role |
| `audit_logs` | Change tracking | entity_type, entity_id, action |

### Common Queries

```sql
-- Get project with team
SELECT p.*, json_agg(json_build_object(
  'userId', u.id,
  'name', u.name,
  'role', ptm.role
)) as team_members
FROM projects p
LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
LEFT JOIN users u ON ptm.user_id = u.id
WHERE p.id = $1
GROUP BY p.id;

-- Get area hierarchy
WITH RECURSIVE area_tree AS (
  SELECT * FROM areas WHERE project_id = $1 AND parent_area_id IS NULL
  UNION ALL
  SELECT a.* FROM areas a
  INNER JOIN area_tree at ON a.parent_area_id = at.id
)
SELECT * FROM area_tree ORDER BY level, sort_order;

-- Check if user is project member
SELECT EXISTS(
  SELECT 1 FROM project_team_members
  WHERE project_id = $1 AND user_id = $2 AND is_active = true
);
```

---

## 🔌 API Quick Reference

### Authentication
```bash
# All requests need JWT token
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/projects
```

### Projects

```bash
# Create project
POST /api/v1/projects
Content-Type: application/json
{
  "name": "Sattva City",
  "code": "SAT-001",
  "clientName": "Sattva City Pvt Ltd"
}

# Get project
GET /api/v1/projects/:id

# List projects
GET /api/v1/projects?status=active&page=1&limit=20

# Update project
PUT /api/v1/projects/:id
{
  "name": "Updated Name"
}

# Delete project
DELETE /api/v1/projects/:id
```

### Areas

```bash
# Create area
POST /api/v1/areas
{
  "projectId": "uuid",
  "code": "ZONE-01",
  "name": "Marketing Office",
  "parentAreaId": null  # null for zone, uuid for area
}

# Get areas (flat list)
GET /api/v1/projects/:projectId/areas

# Get area hierarchy (tree)
GET /api/v1/projects/:projectId/areas/hierarchy

# Reorder areas
PUT /api/v1/projects/:projectId/areas/reorder
{
  "areaIds": ["uuid1", "uuid2", "uuid3"]
}
```

### Team Members

```bash
# Add team member
POST /api/v1/projects/:projectId/team
{
  "userId": "uuid",
  "role": "site_qs"  # ho_qs, site_qs, project_incharge
}

# List team members
GET /api/v1/projects/:projectId/team

# Remove team member
DELETE /api/v1/projects/:projectId/team/:userId
```

---

## 🧪 Testing Quick Reference

### Run Tests
```bash
# Run all tests
npm test
# OR
pytest

# Run with coverage
npm run test:coverage
# OR
pytest --cov

# Run specific test file
npm test ProjectService.test.ts
# OR
pytest tests/unit/test_project_service.py

# Run E2E tests
npm run test:e2e
# OR
pytest tests/e2e/
```

### Writing Tests

**Unit Test Example (Jest/TypeScript):**
```typescript
import { ProjectService } from '../services/ProjectService';
import { ProjectRepository } from '../repositories/ProjectRepository';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepo: jest.Mocked<ProjectRepository>;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      // ... other methods
    } as any;
    
    service = new ProjectService(mockRepo);
  });

  it('should create project with valid data', async () => {
    const projectData = {
      name: 'Test Project',
      code: 'TEST-001',
      clientName: 'Test Client'
    };
    
    mockRepo.create.mockResolvedValue({ id: 'uuid', ...projectData });
    
    const result = await service.createProject(projectData, 'user-id');
    
    expect(result.name).toBe('Test Project');
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Project',
      code: 'TEST-001'
    }));
  });

  it('should throw error for invalid project code', async () => {
    const projectData = {
      name: 'Test',
      code: 'invalid code',  // lowercase, has space
      clientName: 'Test'
    };
    
    await expect(service.createProject(projectData, 'user-id'))
      .rejects.toThrow('Project code must contain only uppercase');
  });
});
```

**API Test Example (Supertest):**
```typescript
import request from 'supertest';
import { app } from '../app';

describe('POST /api/v1/projects', () => {
  it('should create project with valid data', async () => {
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'Test Project',
        code: 'TEST-001',
        clientName: 'Test Client'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Test Project');
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app)
      .post('/api/v1/projects')
      .send({
        name: 'Test Project',
        code: 'TEST-001'
      });
    
    expect(response.status).toBe(401);
  });
});
```

---

## 🎨 Frontend Quick Reference

### Redux Store Structure
```typescript
// store/slices/projectsSlice.ts
interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  filters: {
    status: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// Actions
export const {
  setProjects,
  setCurrentProject,
  setLoading,
  setError,
  setFilters,
  setPagination
} = projectsSlice.actions;

// Thunks
export const fetchProjects = createAsyncThunk(...);
export const createProject = createAsyncThunk(...);
export const updateProject = createAsyncThunk(...);
```

### Component Example
```tsx
// components/projects/ProjectList.tsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProjects } from '../../store/slices/projectsSlice';
import { DataGrid } from '@mui/x-data-grid';

export const ProjectList: React.FC = () => {
  const dispatch = useDispatch();
  const { projects, loading, pagination } = useSelector(
    (state: RootState) => state.projects
  );

  useEffect(() => {
    dispatch(fetchProjects({ page: 1, limit: 20 }));
  }, [dispatch]);

  const columns = [
    { field: 'code', headerName: 'Code', width: 130 },
    { field: 'name', headerName: 'Name', width: 250 },
    { field: 'clientName', headerName: 'Client', width: 200 },
    { field: 'status', headerName: 'Status', width: 120 }
  ];

  return (
    <DataGrid
      rows={projects}
      columns={columns}
      loading={loading}
      pageSize={pagination.limit}
      rowCount={pagination.total}
      paginationMode="server"
    />
  );
};
```

### API Client Example
```typescript
// services/api/projectsApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const projectsApi = {
  getProjects: (params: ProjectFilters) => 
    api.get('/api/v1/projects', { params }),
  
  getProject: (id: string) => 
    api.get(`/api/v1/projects/${id}`),
  
  createProject: (data: CreateProjectDTO) => 
    api.post('/api/v1/projects', data),
  
  updateProject: (id: string, data: UpdateProjectDTO) => 
    api.put(`/api/v1/projects/${id}`, data),
  
  deleteProject: (id: string) => 
    api.delete(`/api/v1/projects/${id}`)
};
```

---

## 🔐 Authorization Quick Reference

### Roles
- **Admin**: Full access to everything
- **HO QS**: Can create/edit projects, manage BOQ, generate bills
- **Site QS**: Can view projects, enter measurements
- **Project In-charge**: Can view projects, approve bills (future)

### Permission Matrix

| Action | Admin | HO QS | Site QS |
|--------|:-----:|:-----:|:-------:|
| Create Project | ✅ | ✅ | ❌ |
| View Own Projects | ✅ | ✅ | ✅ |
| View All Projects | ✅ | ❌ | ❌ |
| Update Project | ✅ | ✅ | ❌ |
| Delete Project | ✅ | ❌ | ❌ |
| Create Area | ✅ | ✅ | ❌ |
| Add Team Member | ✅ | ✅ | ❌ |

### Check Authorization in Service
```typescript
async updateProject(id: string, data: UpdateProjectDTO, userId: string) {
  // 1. Check if project exists
  const project = await this.projectRepo.findById(id);
  if (!project) throw new NotFoundError('Project not found');
  
  // 2. Get user role
  const user = await this.userRepo.findById(userId);
  
  // 3. Check permission
  if (user.role === 'admin') {
    // Admin can update any project
  } else if (user.role === 'ho_qs') {
    // HO QS can update only if they are project member
    const isMember = await this.teamRepo.isMember(id, userId);
    if (!isMember) throw new ForbiddenError('No access');
  } else {
    // Site QS cannot update projects
    throw new ForbiddenError('Insufficient permissions');
  }
  
  // 4. Proceed with update
  return this.projectRepo.update(id, data);
}
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot connect to database"
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### Issue: "JWT token expired"
```bash
# Token expiry is 24 hours
# Get new token by logging in again
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Issue: "Unique constraint violation"
```bash
# Project code must be unique
# Check existing codes
SELECT code FROM projects WHERE deleted_at IS NULL;

# Use different code
```

### Issue: "Cannot delete area - has measurements"
```bash
# Check if area has measurements
SELECT COUNT(*) FROM measurements WHERE area_id = 'uuid';

# Delete measurements first, or use different area
```

### Issue: "Tests failing with database errors"
```bash
# Create test database
createdb mbook_test

# Update .env.test
DATABASE_URL=postgresql://user:password@localhost:5432/mbook_test

# Run migrations on test DB
NODE_ENV=test npm run migrate:up
```

---

## 📚 Code Snippets

### Create Audit Log Entry
```typescript
await this.auditLogRepo.create({
  entityType: 'project',
  entityId: project.id,
  action: 'create',
  userId: userId,
  changesBefore: null,
  changesAfter: project,
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

### Soft Delete
```typescript
// Don't hard delete, set deleted_at
async softDelete(id: string) {
  await this.db.query(
    'UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );
}

// Exclude soft-deleted in queries
async findAll() {
  return this.db.query(
    'SELECT * FROM projects WHERE deleted_at IS NULL'
  );
}
```

### Pagination Helper
```typescript
interface PaginationParams {
  page: number;
  limit: number;
}

function getPaginationParams(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;
  
  return { limit, offset };
}

// Use in query
const { limit, offset } = getPaginationParams({ page: 2, limit: 20 });
const projects = await db.query(
  'SELECT * FROM projects LIMIT $1 OFFSET $2',
  [limit, offset]
);
```

### Build Area Tree
```typescript
function buildTree(areas: Area[]): AreaHierarchy[] {
  const areaMap = new Map<string, AreaHierarchy>();
  const roots: AreaHierarchy[] = [];
  
  // Initialize all areas
  areas.forEach(area => {
    areaMap.set(area.id, { ...area, children: [] });
  });
  
  // Build tree
  areas.forEach(area => {
    const node = areaMap.get(area.id)!;
    if (area.parentAreaId) {
      const parent = areaMap.get(area.parentAreaId);
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  // Sort by sort_order
  const sort = (nodes: AreaHierarchy[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach(node => sort(node.children));
  };
  sort(roots);
  
  return roots;
}
```

---

## 🔧 Useful Commands

### Database
```bash
# Connect to database
psql mbook_dev

# List tables
\dt

# Describe table
\d projects

# Run SQL file
psql mbook_dev < database/schema.sql

# Backup database
pg_dump mbook_dev > backup.sql

# Restore database
psql mbook_dev < backup.sql
```

### Git
```bash
# Create feature branch
git checkout -b feature/project-management

# Commit with message
git commit -m "feat: implement project creation API"

# Push to remote
git push origin feature/project-management

# Create pull request
gh pr create --title "Project Management Module" --body "..."
```

### Docker (if using)
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend npm run migrate:up

# Stop services
docker-compose down
```

---

## 📊 Performance Tips

1. **Use indexes** on frequently queried columns (foreign keys, status, dates)
2. **Paginate** all list endpoints (default 20 items)
3. **Use connection pooling** for database connections
4. **Cache** frequently accessed data (user roles, project list)
5. **Optimize queries** - avoid N+1, use joins instead of multiple queries
6. **Lazy load** frontend components
7. **Debounce** search inputs (300ms delay)
8. **Monitor** slow queries and optimize

---

## 🆘 Getting Help

- **Documentation:** See `/docs` folder
- **API Docs:** http://localhost:8000/api/docs
- **Team Chat:** Slack #mbook-dev
- **Issues:** GitHub Issues
- **Code Review:** Create PR and request review

---

## ✅ Before Committing Checklist

- [ ] Code follows style guide (ESLint/Pylint passes)
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] No console.log or print statements
- [ ] Comments added for complex logic
- [ ] TypeScript types defined
- [ ] Error handling implemented
- [ ] Audit logging added (for data changes)
- [ ] Authorization checks in place
- [ ] Database queries optimized
- [ ] API documented (Swagger)
- [ ] README updated if needed

---

**Quick Reference Version:** 1.0  
**Last Updated:** February 15, 2026  
**For:** M-Book Project Management Module
