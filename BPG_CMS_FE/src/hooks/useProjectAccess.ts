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
  const normalizedProjectId = projectId == null ? '' : String(projectId);
  const query = useQuery({
    queryKey: projectAccessQueryKey(normalizedProjectId),
    queryFn: () => projectService.getMyAccess(normalizedProjectId),
    enabled: normalizedProjectId.length > 0,
    staleTime: 30_000,
  });

  return {
    ...query,
    access: query.data,
    isProjectMember: query.data?.isMember ?? false,
    isProjectLeader: query.data?.isLeader ?? false,
    canViewProject: hasAnyRole(RoleGroup.ProjectViewers) || (query.data?.isMember ?? false),
    canManageExecution:
      hasAnyRole(RoleGroup.Execution) || (query.data?.isLeader ?? false),
    canManageTechnical:
      hasAnyRole(RoleGroup.Technical) || (query.data?.isLeader ?? false),
    canManageAccounting: hasAnyRole(RoleGroup.Accounting),
    canManageInventory: hasAnyRole(RoleGroup.Inventory),
    canApprove: hasAnyRole(RoleGroup.Approval),
    canViewReports: hasAnyRole(RoleGroup.Reports) || (query.data?.isMember ?? false),
  };
};
