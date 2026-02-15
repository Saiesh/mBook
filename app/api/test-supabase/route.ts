/**
 * Supabase Connection & CRUD Test API
 * GET /api/test-supabase - Verifies tables exist and runs CRUD operations
 * Use for development only - consider disabling in production
 */

import { NextResponse } from 'next/server';
import {
  createProjectRepository,
  createAreaRepository,
  createProjectTeamRepository,
} from '@/lib/project-management';
import { supabaseAdmin } from '@/lib/supabase';

const REQUIRED_TABLES = [
  'users',
  'projects',
  'project_team_members',
  'areas',
  'audit_logs',
];

interface TestResult {
  step: string;
  success: boolean;
  message?: string;
  details?: unknown;
}

async function getOrCreateTestUser(): Promise<string> {
  if (!supabaseAdmin) throw new Error('Supabase not configured');

  // 1. Try to get any existing user from public.users
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .limit(1);

  if (!error && users && users.length > 0) {
    return users[0].id;
  }

  // 2. Try Supabase Auth + sync (003_supabase_full.sql schema)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: `test-${Date.now()}@mbook-test.local`,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { name: 'Test User', phone: '+1234567890' },
    });

  const userId = authData?.user?.id;
  if (userId && !authError) {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: check } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (check) return userId;
    }
  }

  // 3. Fallback: direct insert for 001 schema (custom users with password_hash)
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('users')
    .insert({
      email: `test-${Date.now()}@mbook-test.local`,
      password_hash:
        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // "password"
      name: 'Test User',
      phone: null,
    })
    .select('id')
    .single();

  if (!insertError && inserted?.id) {
    return inserted.id;
  }

  throw new Error(
    `No users in public.users. Create one via app signup, or run 003_supabase_full.sql for auth sync. ` +
      (authError ? `Auth: ${authError.message}. ` : '') +
      (insertError ? `Insert: ${insertError.message}` : '')
  );
}

export async function GET() {
  const results: TestResult[] = [];

  try {
    // 1. Connection check
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local',
          results: [],
        },
        { status: 503 }
      );
    }

    results.push({ step: 'Connection', success: true, message: 'Supabase client initialized' });

    // 2. Verify tables exist (query each table; 42P01 = relation does not exist)
    const missingTables: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const { error: tableError } = await supabaseAdmin
        .from(table as 'projects')
        .select('*')
        .limit(0);
      const isMissing =
        tableError &&
        (tableError.code === '42P01' ||
          /does not exist|relation.*exist/i.test(tableError.message || ''));
      if (isMissing) {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Missing tables: ${missingTables.join(', ')}. Run project-management/database/003_supabase_full.sql in Supabase SQL Editor.`,
          results: [
            ...results,
            {
              step: 'Tables',
              success: false,
              message: `Missing: ${missingTables.join(', ')}`,
              details: { required: REQUIRED_TABLES },
            },
          ],
        },
        { status: 503 }
      );
    }

    results.push({
      step: 'Tables',
      success: true,
      message: `All required tables exist: ${REQUIRED_TABLES.join(', ')}`,
    });

    // 3. Get or create test user
    const userId = await getOrCreateTestUser();
    results.push({
      step: 'Test user',
      success: true,
      message: `Using user ID: ${userId.slice(0, 8)}...`,
    });

    const projectRepo = createProjectRepository();
    const areaRepo = createAreaRepository();
    const teamRepo = createProjectTeamRepository();

    // 4. Project CRUD
    const code = `TEST-${Date.now()}`;
    const project = await projectRepo.create(
      {
        name: 'Supabase CRUD Test Project',
        code,
        clientName: 'Test Client',
        location: { city: 'Test City', state: 'TS' },
        description: 'Auto-created by /api/test-supabase',
      },
      userId
    );

    results.push({
      step: 'Project Create',
      success: true,
      message: `Created project: ${project.name} (${project.id})`,
    });

    const found = await projectRepo.findById(project.id);
    if (!found) {
      results.push({ step: 'Project Read', success: false, message: 'Project not found after create' });
    } else {
      results.push({ step: 'Project Read', success: true, message: `Found project: ${found.code}` });
    }

    const updated = await projectRepo.update(project.id, {
      description: 'Updated by CRUD test',
    });
    results.push({
      step: 'Project Update',
      success: true,
      message: `Updated: ${updated.description}`,
    });

    // 5. Area CRUD (zone + area)
    const zone = await areaRepo.create({
      projectId: project.id,
      code: 'Z1',
      name: 'Zone 1',
      sortOrder: 0,
    });
    results.push({
      step: 'Area Create (Zone)',
      success: true,
      message: `Created zone: ${zone.name}`,
    });

    const area = await areaRepo.create({
      projectId: project.id,
      code: 'A1',
      name: 'Area 1',
      parentAreaId: zone.id,
      sortOrder: 0,
    });
    results.push({
      step: 'Area Create (Area)',
      success: true,
      message: `Created area: ${area.name} under zone`,
    });

    const hierarchy = await areaRepo.getHierarchy(project.id);
    results.push({
      step: 'Area Hierarchy',
      success: hierarchy.length > 0 && hierarchy[0].children?.length === 1,
      message: `Hierarchy: ${hierarchy.length} zones, ${hierarchy[0]?.children?.length ?? 0} child areas`,
    });

    // 6. Project team CRUD
    await teamRepo.addMember({
      projectId: project.id,
      userId,
      role: 'site_qs',
    });
    results.push({ step: 'Team Add Member', success: true });

    const teamMembers = await teamRepo.getTeamMembers(project.id);
    results.push({
      step: 'Team List',
      success: teamMembers.length >= 1,
      message: `${teamMembers.length} member(s)`,
    });

    const isMember = await teamRepo.isMember(project.id, userId);
    results.push({
      step: 'Team Membership Check',
      success: isMember,
      message: isMember ? 'User is member' : 'User not found as member',
    });

    // 7. Cleanup: soft delete project (cascades handled by app logic; areas/team stay but project is soft-deleted)
    await projectRepo.softDelete(project.id);
    const afterDelete = await projectRepo.findById(project.id);
    results.push({
      step: 'Project Soft Delete',
      success: afterDelete === null,
      message: afterDelete ? 'Project still visible (fail)' : 'Project soft-deleted correctly',
    });

    const allPassed = results.every((r) => r.success);
    return NextResponse.json({
      success: allPassed,
      message: allPassed
        ? 'All Supabase tables and CRUD operations passed.'
        : 'Some steps failed. See results.',
      results,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    results.push({
      step: 'Error',
      success: false,
      message: error.message,
      details: error.stack,
    });
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        results,
      },
      { status: 500 }
    );
  }
}
