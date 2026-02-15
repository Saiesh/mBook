/**
 * ProjectTeamRepository - Data access layer for project team member assignments
 * Manages add/remove, queries team by project (with user details), projects by user, and membership check
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProjectTeamRepository } from './IProjectTeamRepository';
import type {
  Project,
  ProjectTeamMember,
  TeamMemberWithUser,
  AddTeamMemberDTO,
} from '../types';

/** Database row shape for project_team_members (snake_case) */
interface ProjectTeamMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  removed_at: string | null;
  is_active: boolean;
}

/** Joined row with user from getTeamMembers (Supabase embed returns `user` when using alias) */
interface TeamMemberJoinRow {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
  } | null;
}

/** Projects table row (snake_case) - for getUserProjects */
interface ProjectRow {
  id: string;
  name: string;
  code: string;
  client_name: string | null;
  location_city: string | null;
  location_state: string | null;
  location_address: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  description: string | null;
  budget: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToProjectTeamMember(row: ProjectTeamMemberRow): ProjectTeamMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role as ProjectTeamMember['role'],
    assignedAt: row.assigned_at,
    removedAt: row.removed_at,
    isActive: row.is_active,
  };
}

function joinRowToTeamMemberWithUser(row: TeamMemberJoinRow): TeamMemberWithUser {
  const u = row.user;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role as TeamMemberWithUser['role'],
    assignedAt: row.assigned_at,
    user: u
      ? { id: u.id, email: u.email, name: u.name, phone: u.phone }
      : {
          id: row.user_id,
          email: '',
          name: 'Unknown',
          phone: null,
        },
  };
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    clientName: row.client_name,
    location: {
      city: row.location_city,
      state: row.location_state,
      address: row.location_address,
    },
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Project['status'],
    description: row.description,
    budget: row.budget != null ? Number(row.budget) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class ProjectTeamRepository implements IProjectTeamRepository {
  constructor(private readonly db: SupabaseClient) {
    if (!db) {
      throw new Error('ProjectTeamRepository requires a Supabase client');
    }
  }

  async addMember(member: AddTeamMemberDTO): Promise<ProjectTeamMember> {
    // Check if previously removed record exists (same project, user, role)
    const { data: existing } = await this.db
      .from('project_team_members')
      .select('id, assigned_at')
      .eq('project_id', member.projectId)
      .eq('user_id', member.userId)
      .eq('role', member.role)
      .maybeSingle();

    if (existing) {
      // Reactivate: set removed_at=null, is_active=true
      const { data, error } = await this.db
        .from('project_team_members')
        .update({
          removed_at: null,
          is_active: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to re-add team member: ${error.message}`);
      }
      return rowToProjectTeamMember(data as ProjectTeamMemberRow);
    }

    // Insert new record
    const row = {
      project_id: member.projectId,
      user_id: member.userId,
      role: member.role,
    };

    const { data, error } = await this.db
      .from('project_team_members')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add team member: ${error.message}`);
    }
    return rowToProjectTeamMember(data as ProjectTeamMemberRow);
  }

  async removeMember(
    projectId: string,
    userId: string,
    role: string
  ): Promise<void> {
    const { error } = await this.db
      .from('project_team_members')
      .update({
        removed_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('role', role)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to remove team member: ${error.message}`);
    }
  }

  async getTeamMembers(projectId: string): Promise<TeamMemberWithUser[]> {
    const { data, error } = await this.db
      .from('project_team_members')
      .select(
        `
        id,
        project_id,
        user_id,
        role,
        assigned_at,
        user:users(id, email, name, phone)
      `
      )
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get team members: ${error.message}`);
    }

    return (data ?? []).map((row) =>
      joinRowToTeamMemberWithUser(row as TeamMemberJoinRow)
    );
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    const { data: members, error: membersError } = await this.db
      .from('project_team_members')
      .select('project_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (membersError) {
      throw new Error(`Failed to get user projects: ${membersError.message}`);
    }

    const projectIds = [...new Set((members ?? []).map((m) => m.project_id))];
    if (projectIds.length === 0) {
      return [];
    }

    const { data: projects, error: projectsError } = await this.db
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .is('deleted_at', null);

    if (projectsError) {
      throw new Error(`Failed to get projects: ${projectsError.message}`);
    }

    return (projects ?? []).map((row) => rowToProject(row as ProjectRow));
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('project_team_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check membership: ${error.message}`);
    }
    return (data?.length ?? 0) > 0;
  }
}
