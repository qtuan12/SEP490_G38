import { useQuery } from '@tanstack/react-query';
import { hasPermission } from '../auth/permissions';
import type { ProjectPermissionValue } from '../auth/permissions';
import { projectService } from '../services/projectService';

export const projectAccessQueryKey = (projectId: string | number) =>
  ['project-access', String(projectId)] as const;

export const useProjectAccess = (
  projectId: string | number | null | undefined,
) => {
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
    hasProjectPermission: (permission: ProjectPermissionValue | string) =>
      hasPermission(query.data?.permissions, permission),
  };
};
