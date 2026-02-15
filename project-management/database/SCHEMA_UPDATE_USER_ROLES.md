# Database Schema Update - User Roles

## Summary
Updated the database schema to support user roles in the authentication system. This is the foundation for implementing role-based access control (Admin, HO QS, Site QS).

## Changes Made

### 1. Updated `003_supabase_full.sql`

#### Added user_role ENUM Type
```sql
CREATE TYPE user_role AS ENUM ('admin', 'ho_qs', 'site_qs');
```

#### Enhanced public.users Table
Added the following columns:
- `role user_role NOT NULL DEFAULT 'site_qs'` - User's role in the system
- `is_active BOOLEAN NOT NULL DEFAULT true` - Whether user account is active
- `last_login_at TIMESTAMP WITH TIME ZONE` - Last successful login timestamp
- `created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP` - Account creation time
- `updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP` - Last update time

#### Added Index
- `idx_users_role` - Index on role column (filtered for active users only)

#### Updated Sync Trigger
Modified `sync_auth_user_to_users()` function to:
- Extract `role` from `auth.users.raw_user_meta_data->>'role'`
- Extract `is_active` from `auth.users.raw_user_meta_data->>'is_active'`
- Sync `last_login_at` from `auth.users.last_sign_in_at`
- Default role to `'site_qs'` if not specified
- Default is_active to `true` if not specified
- Update `updated_at` timestamp on every sync

#### Updated Backfill Script
Modified to populate new columns from existing `auth.users` data

#### Added Updated_at Trigger
Added trigger to automatically update `updated_at` column when user records are modified

### 2. Created Migration Script

Created `project-management/database/migrations/001_add_user_roles.sql` for users who already have the database deployed.

This migration:
- Creates the `user_role` ENUM type
- Adds new columns to existing `public.users` table
- Creates the role index
- Updates the sync trigger function
- Ensures all triggers are in place
- Backfills `last_login_at` for existing users

## User Metadata Schema

When creating users via Supabase Admin API, include these fields in `user_metadata`:

```typescript
{
  name: string;           // User's full name
  phone?: string;         // Optional phone number
  role: 'admin' | 'ho_qs' | 'site_qs';  // User role
  is_active?: boolean;    // Account status (default: true)
}
```

## Usage

### For New Deployments
Run `003_supabase_full.sql` - it now includes all user role functionality.

### For Existing Deployments
Run `migrations/001_add_user_roles.sql` to add user role support to existing schema.

## Schema Compatibility

The trigger functions maintain backward compatibility with:
- Schema 003 (no password_hash column) - standard Supabase Auth
- Schema 001 (with password_hash column) - legacy schema

## Next Steps

With the database schema updated, the following can now be implemented:
1. User management repository layer
2. Authentication API routes
3. User creation with role assignment
4. Role-based route protection

## Testing

To verify the schema is working:

```sql
-- Check that user_role enum exists
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype;

-- Verify users table structure
\d public.users

-- Test trigger by creating a user via Supabase Auth
-- The user should automatically appear in public.users with default role
```
