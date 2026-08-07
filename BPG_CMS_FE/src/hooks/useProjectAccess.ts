import { useQuery } from '@tanstack/react-query';
import { Role, RoleGroup } from '../auth/roles';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';

export const projectAccessQueryKey = (projectId: string | number) =>
  ['project-access', String(projectId)] as const;

export const useProjectAccess = (
  projectId: string | number | null | undefined,
) => {
  const { hasAnyRole } = useAuth();
  const normalizedProjectId = projectId == null ? '' : String(projectId).replace(/^p-/, '');
  const query = useQuery({
    queryKey: projectAccessQueryKey(normalizedProjectId),
    queryFn: () => projectService.getMyAccess(normalizedProjectId),
    enabled: normalizedProjectId.length > 0,
    staleTime: 30_000,
  });

  const projectQuery = useQuery({
    queryKey: ['projectAccessDetail', normalizedProjectId],
    queryFn: () => projectService.getProjectById(normalizedProjectId),
    enabled: normalizedProjectId.length > 0,
    staleTime: 10_000,
  });

  const isPaused = (projectQuery.data?.status || '').toLowerCase() === 'paused';

  const isGlobalAuthority = hasAnyRole([
    Role.Admin,
    Role.TechnicalManager,
    Role.Accountant,
    Role.Director,
  ]);

  const isProjectMember = query.data?.isMember ?? false;
  const isProjectLeader = query.data?.isLeader ?? false;
  const canViewProject = isGlobalAuthority || (query.data?.canViewProject ?? isProjectMember);

  return {
    ...query,
    access: query.data,
    project: projectQuery.data,
    isPaused,
    isGlobalAuthority,
    isProjectMember,
    isProjectLeader,
    isTechnicalManager:
      hasAnyRole(RoleGroup.Technical) || hasAnyRole(RoleGroup.AdminOnly),
    canViewProject,
    canManageExecution: !isPaused && (hasAnyRole(RoleGroup.Execution) || isProjectLeader),
    canManageTechnical: !isPaused && (hasAnyRole(RoleGroup.Technical) || isProjectLeader),
    canManageAccounting: !isPaused && hasAnyRole(RoleGroup.Accounting),
    canManageInventory: !isPaused && hasAnyRole(RoleGroup.Inventory),
    canApprove: !isPaused && hasAnyRole(RoleGroup.Approval),
    canViewReports: hasAnyRole(RoleGroup.Reports) || isProjectMember,
  };
};
