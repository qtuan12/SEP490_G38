import { useQuery } from '@tanstack/react-query';
import { RoleGroup } from '../auth/roles';
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

  return {
    ...query,
    access: query.data,
    project: projectQuery.data,
    isPaused,
    isProjectMember: query.data?.isMember ?? false,
    isProjectLeader: query.data?.isLeader ?? false,
    isTechnicalManager: hasAnyRole(RoleGroup.Technical),
    canViewProject: hasAnyRole(RoleGroup.ProjectViewers) || (query.data?.isMember ?? false),
    canManageExecution: !isPaused && (hasAnyRole(RoleGroup.Execution) || (query.data?.isLeader ?? false)),
    canManageTechnical: !isPaused && (hasAnyRole(RoleGroup.Technical) || (query.data?.isLeader ?? false)),
    canManageAccounting: !isPaused && hasAnyRole(RoleGroup.Accounting),
    canManageInventory: !isPaused && hasAnyRole(RoleGroup.Inventory),
    canApprove: !isPaused && hasAnyRole(RoleGroup.Approval),
    canViewReports: hasAnyRole(RoleGroup.Reports) || (query.data?.isMember ?? false),
  };
};
