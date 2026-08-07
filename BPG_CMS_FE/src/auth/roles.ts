export type UserRole =
  | 'admin'
  | 'technicalmanager'
  | 'siteengineer'
  | 'accountant'
  | 'director';

export const Role = {
  Admin: 'admin',
  TechnicalManager: 'technicalmanager',
  SiteEngineer: 'siteengineer',
  Accountant: 'accountant',
  Director: 'director',
} as const satisfies Record<string, UserRole>;

export const RoleGroup = {
  AdminOnly: [Role.Admin],
  ProjectViewers: [
    Role.TechnicalManager,
    Role.SiteEngineer,
    Role.Accountant,
    Role.Director,
  ],
  ProjectManagers: [Role.TechnicalManager],
  SupplierViewers: [
    Role.TechnicalManager,
    Role.SiteEngineer,
    Role.Accountant,
    Role.Director,
  ],
  SupplierManagers: [Role.TechnicalManager, Role.Accountant],
  Procurement: [
    Role.TechnicalManager,
    Role.Accountant,
    Role.Director,
  ],
  Reports: [
    Role.TechnicalManager,
    Role.SiteEngineer,
    Role.Accountant,
    Role.Director,
  ],
  MasterData: [Role.TechnicalManager, Role.Accountant],
  Execution: [Role.TechnicalManager, Role.SiteEngineer],
  Technical: [Role.TechnicalManager],
  Accounting: [Role.Accountant],
  Approval: [Role.Director],
  Inventory: [Role.TechnicalManager, Role.Accountant, Role.Director],
} as const;

export const normalizeRole = (role: string): UserRole =>
  role.toLowerCase() as UserRole;

export const hasAnyRole = (
  roles: readonly string[] | undefined,
  allowedRoles: readonly string[],
): boolean => {
  if (!roles || roles.length === 0) return false;
  const normalizedAllowed = allowedRoles.map((a) => a.toLowerCase());
  return roles.some((role) => normalizedAllowed.includes(role.toLowerCase()));
};
