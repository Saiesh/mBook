# Manual Testing Guide - Project Management Features

This guide provides step-by-step instructions for manually testing all project management features after implementation.

## Prerequisites

### 1. Database Setup

**Run the database schema:**
```bash
# From the repository root (so `database/003_supabase_full.sql` resolves). Connect to your Supabase DB and run:
psql -h <your-supabase-host> -U postgres -d postgres -f database/003_supabase_full.sql
```

**Verify tables created:**
- `public.users`
- `public.projects`
- `public.project_areas`
- `public.project_team_members`
- `public.project_audit_log`

### 2. Environment Setup

**Check `.env.local` has required values:**
```bash
# Should contain:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Start Development Server

```bash
# From the repository root:
npm run dev
# Server should start at http://localhost:3000
```

### 4. Create Test Users (Optional)

If you need test users for team management, insert them manually:

```sql
-- Insert test users into public.users
INSERT INTO public.users (id, email, name, phone) VALUES
('11111111-1111-1111-1111-111111111111', 'john@example.com', 'John Doe', '+1234567890'),
('22222222-2222-2222-2222-222222222222', 'jane@example.com', 'Jane Smith', '+1234567891'),
('33333333-3333-3333-3333-333333333333', 'bob@example.com', 'Bob Wilson', '+1234567892');
```

---

## Testing Flow

### Test Order
1. API Routes (backend)
2. Projects CRUD
3. Areas Management
4. Team Management
5. Admin Dashboard Integration

---

## 1. API Routes Testing

Use browser DevTools, curl, or Postman to test API endpoints directly.

### 1.1 Test Projects List API

**Request:**
```bash
curl http://localhost:3000/api/projects
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "data": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 20,
      "totalPages": 0
    }
  }
}
```

**Test Filters:**
```bash
# Filter by status
curl "http://localhost:3000/api/projects?status=active"

# Search
curl "http://localhost:3000/api/projects?search=test"

# Pagination
curl "http://localhost:3000/api/projects?page=1&limit=10"

# Sorting
curl "http://localhost:3000/api/projects?sortBy=name&sortOrder=asc"
```

### 1.2 Test Create Project API

**Request:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project 1",
    "code": "TEST001",
    "clientName": "Acme Corp",
    "location": {
      "city": "Mumbai",
      "state": "Maharashtra",
      "address": "123 Main St"
    },
    "startDate": "2026-03-01",
    "endDate": "2026-12-31",
    "budget": 5000000,
    "description": "Test project for manual testing"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Test Project 1",
    "code": "TEST001",
    "status": "active",
    ...
  }
}
```

**Test Validation:**
- Missing required fields → 400 error
- Duplicate code → 409 error
- Invalid status → 400 error

### 1.3 Test Get Single Project API

**Request:**
```bash
# Use the project ID from create response
curl http://localhost:3000/api/projects/{project-id}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Test Project 1",
    ...
  }
}
```

**Test Errors:**
- Invalid ID → 404 error
- Non-existent ID → 404 error

### 1.4 Test Update Project API

**Request:**
```bash
curl -X PUT http://localhost:3000/api/projects/{project-id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project 1 - Updated",
    "status": "on_hold"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Test Project 1 - Updated",
    "status": "on_hold",
    ...
  }
}
```

### 1.5 Test Areas API

**Create Zone (Level 1):**
```bash
curl -X POST http://localhost:3000/api/projects/{project-id}/areas \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{project-id}",
    "code": "ZONE-A",
    "name": "Ground Floor",
    "description": "Ground floor area",
    "parentAreaId": null
  }'
```

**Create Sub-area (Level 2):**
```bash
curl -X POST http://localhost:3000/api/projects/{project-id}/areas \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{project-id}",
    "code": "AREA-A1",
    "name": "Living Room",
    "parentAreaId": "{zone-id}"
  }'
```

**Get Area Hierarchy:**
```bash
curl http://localhost:3000/api/projects/{project-id}/areas
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "code": "ZONE-A",
      "name": "Ground Floor",
      "level": 1,
      "children": [
        {
          "id": "...",
          "code": "AREA-A1",
          "name": "Living Room",
          "level": 2
        }
      ]
    }
  ]
}
```

### 1.6 Test Team API

**Add Team Member:**
```bash
curl -X POST http://localhost:3000/api/projects/{project-id}/team \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{project-id}",
    "userId": "11111111-1111-1111-1111-111111111111",
    "role": "ho_qs"
  }'
```

**Get Team Members:**
```bash
curl http://localhost:3000/api/projects/{project-id}/team
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "projectId": "...",
      "userId": "11111111-1111-1111-1111-111111111111",
      "role": "ho_qs",
      "assignedAt": "2026-02-15T...",
      "user": {
        "id": "...",
        "email": "john@example.com",
        "name": "John Doe",
        "phone": "+1234567890"
      }
    }
  ]
}
```

**Remove Team Member:**
```bash
curl -X DELETE "http://localhost:3000/api/projects/{project-id}/team?userId={user-id}&role=ho_qs"
```

---

## 2. UI Testing - Projects CRUD

### 2.1 Admin Dashboard

**Navigate to:** `http://localhost:3000/admin`

**Verify:**
- [ ] "Project Management" card appears in Configuration section
- [ ] Click card → redirects to `/admin/projects`
- [ ] Statistics section shows project counts (if implemented)

### 2.2 Projects List Page

**Navigate to:** `http://localhost:3000/admin/projects`

**Test Empty State:**
- [ ] Page loads without errors
- [ ] Shows "No projects found" message (if empty)
- [ ] "New Project" button is visible

**Test with Data:**
- [ ] Projects display in table/card format
- [ ] Columns visible: Code, Name, Client, Status, Start Date
- [ ] Status badges have correct colors
- [ ] Click project row → navigates to details page

**Test Filters:**
- [ ] Status tabs work (All, Active, On Hold, Completed, Cancelled)
- [ ] Search box filters by name/code
- [ ] Results update dynamically

**Test Actions:**
- [ ] Click "New Project" → navigates to `/admin/projects/new`
- [ ] Click edit icon → navigates to edit page
- [ ] Click project → navigates to details page

### 2.3 Create Project Page

**Navigate to:** `http://localhost:3000/admin/projects/new`

**Test Form Fields:**
- [ ] All fields render correctly
- [ ] Required fields marked with asterisk (*)
- [ ] Project Code input converts to uppercase
- [ ] Date inputs show date picker
- [ ] Budget field accepts numbers only
- [ ] Status dropdown has all options

**Test Validation:**
- [ ] Submit without required fields → shows validation errors
- [ ] Invalid dates → shows error
- [ ] Negative budget → shows error
- [ ] Duplicate code → shows API error

**Test Success:**
1. Fill in valid data:
   - Code: `DEMO001`
   - Name: `Demo Project`
   - Client: `Test Client`
   - City: `Mumbai`, State: `Maharashtra`
   - Start Date: `2026-03-01`
   - Budget: `1000000`
   - Status: `Active`
2. Click "Save Project"
3. Verify:
   - [ ] Loading indicator appears
   - [ ] Success message/toast shows
   - [ ] Redirects to project details page
   - [ ] New project appears in list

**Test Cancel:**
- [ ] Click "Cancel" → returns to projects list
- [ ] Data not saved

### 2.4 Edit Project Page

**Navigate to:** `http://localhost:3000/admin/projects/{id}`

**Test Loading:**
- [ ] Page loads existing project data
- [ ] All fields pre-filled correctly
- [ ] Status reflects current value
- [ ] Dates formatted correctly

**Test Update:**
1. Change name to `Demo Project - Updated`
2. Change status to `On Hold`
3. Click "Save Changes"
4. Verify:
   - [ ] Success message shows
   - [ ] Changes reflected in details page
   - [ ] Changes reflected in list page

**Test Delete:**
- [ ] "Delete Project" button visible
- [ ] Click delete → confirmation dialog appears
- [ ] Confirm → project soft deleted
- [ ] Project no longer appears in list

### 2.5 Project Details Page

**Navigate to:** `http://localhost:3000/admin/projects/{id}/details`

**Test Display:**
- [ ] Project name and code in header
- [ ] Status badge shows correct status and color
- [ ] Project information card displays all fields
- [ ] Location formatted correctly
- [ ] Dates formatted as readable text
- [ ] Budget formatted as currency

**Test Quick Actions:**
- [ ] "Edit Project" button → navigates to edit page
- [ ] "Manage Areas" button → navigates to areas page
- [ ] "Manage Team" button → navigates to team page

**Test Summaries:**
- [ ] Team members count displayed
- [ ] Areas count displayed (zones and sub-areas)

---

## 3. UI Testing - Areas Management

**Navigate to:** `http://localhost:3000/admin/projects/{id}/areas`

### 3.1 Test Empty State

**Verify:**
- [ ] "No areas defined" message shows (if empty)
- [ ] "Add Zone" button visible

### 3.2 Test Add Zone (Level 1)

1. Click "Add Zone"
2. Fill form:
   - Code: `ZONE-A`
   - Name: `Ground Floor`
   - Description: `Ground floor area`
3. Click "Save"
4. Verify:
   - [ ] Zone appears in list
   - [ ] Level indicator shows "Zone"
   - [ ] Code and name displayed correctly
   - [ ] Can expand/collapse zone

### 3.3 Test Add Sub-area (Level 2)

1. Click "Add Sub-area" under a zone
2. Fill form:
   - Code: `AREA-A1`
   - Name: `Living Room`
   - Description: `Main living room`
3. Click "Save"
4. Verify:
   - [ ] Sub-area appears nested under zone
   - [ ] Indentation/hierarchy visual is clear
   - [ ] Level indicator shows "Area"

### 3.4 Test Hierarchy Display

**Create multiple zones and areas:**
```
Zone A (ZONE-A) - Ground Floor
  ├─ Area A1 (AREA-A1) - Living Room
  └─ Area A2 (AREA-A2) - Kitchen
Zone B (ZONE-B) - First Floor
  ├─ Area B1 (AREA-B1) - Bedroom 1
  └─ Area B2 (AREA-B2) - Bedroom 2
```

**Verify:**
- [ ] Tree structure displays correctly
- [ ] Parent-child relationships clear
- [ ] Expand/collapse works
- [ ] Zones appear before their children

### 3.5 Test Edit Area

1. Click "Edit" on an area
2. Change name to `Living Room - Main`
3. Click "Save"
4. Verify:
   - [ ] Name updates in tree
   - [ ] Hierarchy maintained

### 3.6 Test Delete Area

**Delete sub-area:**
1. Click "Delete" on a sub-area
2. Confirm deletion
3. Verify:
   - [ ] Sub-area removed from tree
   - [ ] Parent zone still exists

**Delete zone with children:**
1. Click "Delete" on a zone with children
2. Should show error: "Cannot delete zone with sub-areas"
3. Verify:
   - [ ] Zone not deleted
   - [ ] Error message shown

**Delete empty zone:**
1. Delete all sub-areas first
2. Click "Delete" on empty zone
3. Verify:
   - [ ] Zone removed successfully

### 3.7 Test Reordering (if implemented)

1. Drag zone to reorder
2. Verify:
   - [ ] Visual feedback during drag
   - [ ] New order persists after refresh
   - [ ] API called with new sortOrder

---

## 4. UI Testing - Team Management

**Navigate to:** `http://localhost:3000/admin/projects/{id}/team`

### 4.1 Test Empty State

**Verify:**
- [ ] "No team members" message shows
- [ ] "Add Member" button visible

### 4.2 Test Add Team Member

1. Click "Add Member"
2. Select user from dropdown (e.g., "John Doe")
3. Select role: `HO QS`
4. Click "Add"
5. Verify:
   - [ ] Member appears in table
   - [ ] Name, email, phone displayed
   - [ ] Role badge shown with correct color (blue for ho_qs)
   - [ ] Assigned date shown

### 4.3 Test Multiple Members

**Add multiple members with different roles:**
- John Doe - HO QS (blue badge)
- Jane Smith - Site QS (green badge)
- Bob Wilson - Project Incharge (purple badge)

**Verify:**
- [ ] All members listed
- [ ] Role badges have different colors
- [ ] Table formatted correctly

### 4.4 Test Duplicate Prevention

1. Try adding same user with same role again
2. Verify:
   - [ ] Error message: "User already assigned this role"
   - [ ] OR reactivates if previously removed

### 4.5 Test Remove Team Member

1. Click "Remove" on a team member
2. Confirm removal
3. Verify:
   - [ ] Member removed from list
   - [ ] Can be re-added later
   - [ ] Soft delete (isActive = false in DB)

### 4.6 Test Role Badges

**Verify colors:**
- [ ] `ho_qs` → Blue background
- [ ] `site_qs` → Green background
- [ ] `project_incharge` → Purple background

---

## 5. Integration Testing

### 5.1 Full Project Lifecycle

**Create complete project:**
1. Create project "Integration Test"
2. Add 2 zones with 2 sub-areas each
3. Add 3 team members with different roles
4. Update project status to "On Hold"
5. View project details

**Verify:**
- [ ] All data appears correctly
- [ ] Team count shows 3
- [ ] Areas count shows 2 zones + 4 areas
- [ ] Status badge shows "On Hold"

### 5.2 Navigation Flow

**Test navigation between pages:**
1. Dashboard → Projects List
2. Projects List → Create Project
3. Create → Details (after save)
4. Details → Edit Project
5. Details → Manage Areas
6. Details → Manage Team
7. Back buttons work on all pages

**Verify:**
- [ ] No navigation errors
- [ ] Back button always works
- [ ] URLs update correctly
- [ ] Browser back/forward works

### 5.3 Data Persistence

1. Create project with areas and team
2. Close browser/tab
3. Reopen and navigate to project
4. Verify:
   - [ ] Project still exists
   - [ ] Areas hierarchy maintained
   - [ ] Team members still assigned
   - [ ] All data accurate

---

## 6. Error Scenarios

### 6.1 Network Errors

1. Disconnect network
2. Try to create project
3. Verify:
   - [ ] Error message shown
   - [ ] Form not cleared
   - [ ] Can retry after reconnecting

### 6.2 Invalid Data

**Test invalid inputs:**
- [ ] Project code with spaces → validation error
- [ ] End date before start date → validation error
- [ ] Negative budget → validation error
- [ ] Empty required fields → validation error

### 6.3 Non-existent Resources

1. Navigate to `/admin/projects/invalid-uuid`
2. Verify:
   - [ ] 404 error page OR "Project not found" message
   - [ ] Can navigate back to list

### 6.4 Database Errors

1. Stop Supabase temporarily
2. Try to load projects list
3. Verify:
   - [ ] Error message displayed
   - [ ] App doesn't crash
   - [ ] Can retry after DB restored

---

## 7. Mobile Responsiveness

**Test on mobile viewport (Chrome DevTools):**

### 7.1 Projects List
- [ ] Table converts to cards on mobile
- [ ] "New Project" button accessible
- [ ] Status filters visible (maybe as dropdown)
- [ ] Search bar full width

### 7.2 Project Forms
- [ ] Form fields stack vertically
- [ ] Input fields full width
- [ ] Date pickers mobile-friendly
- [ ] Submit buttons full width

### 7.3 Areas Management
- [ ] Tree hierarchy readable
- [ ] Expand/collapse works on touch
- [ ] Action buttons accessible

### 7.4 Team Management
- [ ] Table scrolls horizontally OR converts to cards
- [ ] Add member form usable
- [ ] Role badges visible

---

## 8. Performance Testing

### 8.1 Large Datasets

**Create test data:**
```sql
-- Insert 100 test projects
INSERT INTO public.projects (name, code, status, created_by)
SELECT 
  'Project ' || i,
  'PROJ' || LPAD(i::text, 4, '0'),
  'active',
  '11111111-1111-1111-1111-111111111111'
FROM generate_series(1, 100) i;
```

**Test:**
- [ ] Projects list loads < 3 seconds
- [ ] Pagination works
- [ ] Search responsive
- [ ] Filtering quick

### 8.2 Deep Hierarchy

**Create 5 zones each with 10 sub-areas:**
```sql
-- Insert zones and areas (50+ areas total)
```

**Test:**
- [ ] Tree renders without lag
- [ ] Expand/collapse smooth
- [ ] No UI freezing

---

## 9. Browser Compatibility

**Test on multiple browsers:**
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

**Verify:**
- All features work
- Styling consistent
- No console errors

---

## 10. Test Data Cleanup

**After testing, clean up:**

```sql
-- Delete test projects (cascades to areas and team)
DELETE FROM public.projects WHERE code LIKE 'TEST%' OR code LIKE 'DEMO%';

-- Or delete all
TRUNCATE public.projects CASCADE;
```

---

## Common Issues & Troubleshooting

### Issue: API returns 404
- Check API route file exists
- Verify route path matches
- Check development server running

### Issue: Database errors
- Verify schema applied
- Check Supabase connection
- Verify environment variables

### Issue: Projects not appearing
- Check database has data
- Verify API response in Network tab
- Check console for errors

### Issue: Authentication errors
- Not implemented yet (auth is future phase)
- Use mock user ID for now

### Issue: Styling broken
- Check Tailwind classes
- Verify PostCSS running
- Clear Next.js cache: `rm -rf .next`

---

## Test Checklist Summary

**API Routes:**
- [ ] GET /api/projects (list)
- [ ] POST /api/projects (create)
- [ ] GET /api/projects/:id (get)
- [ ] PUT /api/projects/:id (update)
- [ ] DELETE /api/projects/:id (delete)
- [ ] GET /api/projects/:id/areas (hierarchy)
- [ ] POST /api/projects/:id/areas (create)
- [ ] PUT /api/projects/:id/areas/:areaId (update)
- [ ] DELETE /api/projects/:id/areas/:areaId (delete)
- [ ] GET /api/projects/:id/team (list)
- [ ] POST /api/projects/:id/team (add)
- [ ] DELETE /api/projects/:id/team (remove)

**UI Pages:**
- [ ] Admin dashboard updated
- [ ] Projects list page
- [ ] Create project page
- [ ] Edit project page
- [ ] Project details page
- [ ] Areas management page
- [ ] Team management page

**Features:**
- [ ] CRUD operations work
- [ ] Filtering and search
- [ ] Pagination
- [ ] Form validation
- [ ] Error handling
- [ ] Loading states
- [ ] Mobile responsive
- [ ] Navigation flows

---

## Next Steps After Testing

1. Document any bugs found
2. Add automated tests for critical paths
3. Implement authentication
4. Add authorization checks
5. Deploy to staging environment
6. User acceptance testing
