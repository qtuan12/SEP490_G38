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
  const normalizedProjectId = projectId == null ? '' : String(projectId);
  const query = useQuery({
    queryKey: projectAccessQueryKey(normalizedProjectId),
    queryFn: () => projectService.getMyAccess(normalizedProjectId),
    enabled: normalizedProjectId.length > 0,
    staleTime: 30_000,
  });

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
    isGlobalAuthority,
    isProjectMember,
    isProjectLeader,
    isTechnicalManager:
      hasAnyRole(RoleGroup.Technical) || hasAnyRole(RoleGroup.AdminOnly),
    canViewProject,
    canManageExecution:
      hasAnyRole(RoleGroup.Execution) || isProjectLeader,
    canManageTechnical:
      hasAnyRole(RoleGroup.Technical) || isProjectLeader,
    canManageAccounting: hasAnyRole(RoleGroup.Accounting),
    canManageInventory: hasAnyRole(RoleGroup.Inventory),
    canApprove: hasAnyRole(RoleGroup.Approval),
    canViewReports: hasAnyRole(RoleGroup.Reports) || isProjectMember,
  };
};
