import { hasAnyRole, RoleGroup } from '../../auth/roles';

export const canViewMaterialRequestAssessment = (
  roles: readonly string[] | undefined,
): boolean => hasAnyRole(roles, RoleGroup.Procurement);
