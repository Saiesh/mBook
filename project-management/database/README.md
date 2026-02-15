# Project Management - Database Schema

PostgreSQL schema for the Project Creation and Management module.

## Quick Start

```bash
# Run against local PostgreSQL
psql -U postgres -d mbook -f 001_project_management_schema.sql

# Supabase: use 003_supabase_full.sql (recommended for Supabase Auth)
# In Supabase SQL Editor: copy/paste contents of 003_supabase_full.sql
```

## Tables

| Table | Description | Key Relations |
|-------|-------------|---------------|
| **users** | System users (admin, HO QS, Site QS, Project Incharge) | Referenced by projects, team_members, audit_logs |
| **projects** | Construction projects (soft delete via `deleted_at`) | 1:N areas, M:N users via project_team_members |
| **project_team_members** | Project ↔ User assignments with role | FK: project_id, user_id |
| **areas** | Hierarchical zones/areas (2 levels) | FK: project_id, parent_area_id (self) |
| **audit_logs** | Immutable audit trail | FK: user_id |

## Requirements

- **PostgreSQL 14+** (or Supabase)
- **Extension:** `pg_trgm` (trigram search for project name lookup)

## ENUM Types

- `user_role`: admin, ho_qs, site_qs, project_incharge
- `project_status`: active, completed, on_hold, cancelled
- `team_member_role`: ho_qs, site_qs, project_incharge
- `audit_action`: create, update, delete

## Key Constraints

- **projects:** `end_date >= start_date` (when both set)
- **areas:** Level 1 = zone (no parent), Level 2 = area (must have parent)
- **project_team_members:** UNIQUE(project_id, user_id, role)

## Triggers

- `update_updated_at_column()` auto-updates `updated_at` on users, projects, areas

## Indexes

Optimized for: project list by status, search by name, area hierarchy, audit queries by entity/timestamp.
