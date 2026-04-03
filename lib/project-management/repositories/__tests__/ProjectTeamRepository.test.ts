/**
 * Unit tests for ProjectTeamRepository
 * Tests team member management and authorization checks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectTeamRepository } from '@/lib/project-management/repositories/ProjectTeamRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import {
  createTestSupabaseClient,
  createMockProjectDTO,
  TEST_USER_ID,
  cleanupTestProject,
  generateTestCode,
} from '@/tests/utils/test-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TeamMemberRole } from '@/lib/project-management/types';

// Why: remote Supabase + FK-safe users for `project_team_members` require a seeded DB.
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('ProjectTeamRepository - Integration Tests', () => {
  let db: SupabaseClient;
  let teamRepository: ProjectTeamRepository;
  let projectRepository: ProjectRepository;
  let testProjectId: string;
  const TEST_USER_ID_2 = '00000000-0000-0000-0000-000000000002';
  const TEST_USER_ID_3 = '00000000-0000-0000-0000-000000000003';

  beforeEach(async () => {
    db = createTestSupabaseClient();
    teamRepository = new ProjectTeamRepository(db);
    projectRepository = new ProjectRepository(db);

    // Create a test project
    const projectDto = createMockProjectDTO({
      name: 'Team Test Project',
      code: generateTestCode('TEAM'),
    });
    const project = await projectRepository.create(projectDto, TEST_USER_ID);
    testProjectId = project.id;
  });

  afterEach(async () => {
    // Cleanup will cascade delete team members
    await cleanupTestProject(db, testProjectId);
  });

  describe('addMember()', () => {
    it('should add a team member with ho_qs role', async () => {
      const member = await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'ho_qs',
      });

      expect(member.id).toBeDefined();
      expect(member.projectId).toBe(testProjectId);
      expect(member.userId).toBe(TEST_USER_ID_2);
      expect(member.role).toBe('ho_qs');
      expect(member.assignedAt).toBeDefined();
      expect(member.removedAt).toBeNull();
    });

    it('should add a team member with site_qs role', async () => {
      const member = await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'site_qs',
      });

      expect(member.role).toBe('site_qs');
    });

    it('should add a team member with project_incharge role', async () => {
      const member = await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'project_incharge',
      });

      expect(member.role).toBe('project_incharge');
    });

    it('should allow the same user twice when roles differ', async () => {
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'ho_qs',
      });

      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'site_qs',
      });

      const members = await teamRepository.getTeamMembers(testProjectId);
      expect(members.filter((m) => m.userId === TEST_USER_ID_2)).toHaveLength(2);
    });

    it('should add multiple members to same project', async () => {
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'ho_qs',
      });

      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_3,
        role: 'site_qs',
      });

      const members = await teamRepository.getTeamMembers(testProjectId);
      expect(members.length).toBe(2);
    });
  });

  describe('removeMember()', () => {
    const primaryRole: TeamMemberRole = 'ho_qs';

    beforeEach(async () => {
      // Add a test member
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: primaryRole,
      });
    });

    it('should soft remove a team member', async () => {
      await teamRepository.removeMember(testProjectId, TEST_USER_ID_2, primaryRole);

      const members = await teamRepository.getTeamMembers(testProjectId);
      expect(members.find((m) => m.userId === TEST_USER_ID_2)).toBeUndefined();
    });

    it('should not throw for non-existent member', async () => {
      await expect(
        teamRepository.removeMember(
          testProjectId,
          '00000000-0000-0000-0000-000000000999',
          'site_qs'
        )
      ).resolves.not.toThrow();
    });

    it('should not throw when removing already removed member', async () => {
      await teamRepository.removeMember(testProjectId, TEST_USER_ID_2, primaryRole);
      await expect(
        teamRepository.removeMember(testProjectId, TEST_USER_ID_2, primaryRole)
      ).resolves.not.toThrow();
    });

    it('should update removed_at timestamp', async () => {
      await teamRepository.removeMember(testProjectId, TEST_USER_ID_2, primaryRole);

      // Query directly to check removed_at
      const { data } = await db
        .from('project_team_members')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('user_id', TEST_USER_ID_2)
        .eq('role', primaryRole)
        .maybeSingle();

      expect(data?.removed_at).not.toBeNull();
    });
  });

  describe('getTeamMembers()', () => {
    beforeEach(async () => {
      // Add multiple team members
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'ho_qs',
      });
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_3,
        role: 'site_qs',
      });
    });

    it('should return all active team members', async () => {
      const members = await teamRepository.getTeamMembers(testProjectId);

      expect(members.length).toBe(2);
      expect(members.some((m) => m.userId === TEST_USER_ID_2)).toBe(true);
      expect(members.some((m) => m.userId === TEST_USER_ID_3)).toBe(true);
    });

    it('should not include removed members', async () => {
      await teamRepository.removeMember(testProjectId, TEST_USER_ID_2, 'ho_qs');

      const members = await teamRepository.getTeamMembers(testProjectId);
      expect(members.length).toBe(1);
      expect(members.find((m) => m.userId === TEST_USER_ID_2)).toBeUndefined();
    });

    it('should return empty array for project with no members', async () => {
      // Create new project
      const emptyProjectDto = createMockProjectDTO({
        code: generateTestCode('NOMEM'),
      });
      const emptyProject = await projectRepository.create(
        emptyProjectDto,
        TEST_USER_ID
      );

      const members = await teamRepository.getTeamMembers(emptyProject.id);
      expect(members).toEqual([]);

      await cleanupTestProject(db, emptyProject.id);
    });

    it('should include user details if available', async () => {
      const members = await teamRepository.getTeamMembers(testProjectId);

      expect(members.length).toBeGreaterThan(0);
      // Note: User details may not be available in test environment
      // This is mainly testing that the query doesn't fail with the join
    });

    it('should order by assigned_at', async () => {
      const members = await teamRepository.getTeamMembers(testProjectId);

      expect(members.length).toBeGreaterThan(1);
      for (let i = 1; i < members.length; i++) {
        const prev = new Date(members[i - 1].assignedAt).getTime();
        const curr = new Date(members[i].assignedAt).getTime();
        expect(curr >= prev).toBe(true);
      }
    });
  });

  describe('isMember()', () => {
    beforeEach(async () => {
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'ho_qs',
      });
    });

    it('should return true for active member', async () => {
      const result = await teamRepository.isMember(testProjectId, TEST_USER_ID_2);
      expect(result).toBe(true);
    });

    it('should return false for non-member', async () => {
      const result = await teamRepository.isMember(
        testProjectId,
        '00000000-0000-0000-0000-000000000999'
      );
      expect(result).toBe(false);
    });

    it('should return false for removed member', async () => {
      await teamRepository.removeMember(testProjectId, TEST_USER_ID_2, 'ho_qs');

      const result = await teamRepository.isMember(testProjectId, TEST_USER_ID_2);
      expect(result).toBe(false);
    });

    it('should handle different projects correctly', async () => {
      // Create another project
      const project2Dto = createMockProjectDTO({
        code: generateTestCode('TEAM2'),
      });
      const project2 = await projectRepository.create(project2Dto, TEST_USER_ID);

      // User is member of testProjectId but not project2
      const isInProject1 = await teamRepository.isMember(
        testProjectId,
        TEST_USER_ID_2
      );
      const isInProject2 = await teamRepository.isMember(
        project2.id,
        TEST_USER_ID_2
      );

      expect(isInProject1).toBe(true);
      expect(isInProject2).toBe(false);

      await cleanupTestProject(db, project2.id);
    });
  });

  describe('authorization workflows', () => {
    it('should support checking membership before operations', async () => {
      // Add member
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'site_qs',
      });

      // Check membership
      const canAccess = await teamRepository.isMember(
        testProjectId,
        TEST_USER_ID_2
      );
      expect(canAccess).toBe(true);

      // If member, allow operation (this is just demonstration)
      if (canAccess) {
        const members = await teamRepository.getTeamMembers(testProjectId);
        expect(members.length).toBeGreaterThan(0);
      }
    });

    it('should support role-based access patterns', async () => {
      // Add members with different roles
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_2,
        role: 'ho_qs',
      });
      await teamRepository.addMember({
        projectId: testProjectId,
        userId: TEST_USER_ID_3,
        role: 'project_incharge',
      });

      const members = await teamRepository.getTeamMembers(testProjectId);

      const hoQs = members.find((m) => m.userId === TEST_USER_ID_2);
      const incharge = members.find((m) => m.userId === TEST_USER_ID_3);

      expect(hoQs?.role).toBe('ho_qs');
      expect(incharge?.role).toBe('project_incharge');

      // Role-based logic can be implemented in service layer
      // Here we just verify the roles are stored correctly
    });
  });

  describe('error handling', () => {
    it('should throw error when initialized without client', () => {
      expect(() => new ProjectTeamRepository(null as unknown as SupabaseClient)).toThrow(
        'ProjectTeamRepository requires a Supabase client'
      );
    });

    it('should handle invalid project ID', async () => {
      await expect(
        teamRepository.addMember({
          projectId: '00000000-0000-0000-0000-000000000999',
          userId: TEST_USER_ID_2,
          role: 'ho_qs',
        })
      ).rejects.toThrow();
    });
  });
});
