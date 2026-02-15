/**
 * Project Team Repository Interface
 * Data access contract for project team member assignments
 */

import type {
  ProjectTeamMember,
  TeamMemberWithUser,
  AddTeamMemberDTO,
  Project,
} from '../types';

export interface IProjectTeamRepository {
  addMember(member: AddTeamMemberDTO): Promise<ProjectTeamMember>;
  removeMember(projectId: string, userId: string, role: string): Promise<void>;
  getTeamMembers(projectId: string): Promise<TeamMemberWithUser[]>;
  getUserProjects(userId: string): Promise<Project[]>;
  isMember(projectId: string, userId: string): Promise<boolean>;
}
