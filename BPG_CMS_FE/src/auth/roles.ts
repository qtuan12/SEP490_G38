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
    Role.Admin,
    Role.TechnicalManager,
    Role.SiteEngineer,
    Role.Accountant,
    Role.Director,
  ],
  ProjectManagers: [Role.Admin, Role.TechnicalManager],
  SupplierViewers: [
    Role.Admin,
    Role.TechnicalManager,
    Role.SiteEngineer,
    Role.Accountant,
    Role.Director,
  ],
  SupplierManagers: [Role.Admin, Role.TechnicalManager, Role.Accountant],
  Procurement: [
    Role.Admin,
    Role.TechnicalManager,
    Role.Accountant,
    Role.Director,
  ],
  Reports: [
    Role.Admin,
    Role.TechnicalManager,
    Role.SiteEngineer,
    Role.Accountant,
    Role.Director,
  ],
  MasterData: [Role.Admin, Role.TechnicalManager],
  Execution: [Role.Admin, Role.TechnicalManager, Role.SiteEngineer],
  Technical: [Role.Admin, Role.TechnicalManager],
  Accounting: [Role.Admin, Role.Accountant],
  Approval: [Role.Admin, Role.Director],
  Inventory: [Role.Admin, Role.TechnicalManager, Role.Accountant, Role.Director],
} as const;

export const normalizeRole = (role: string): UserRole =>
  role.toLowerCase() as UserRole;

export const hasAnyRole = (
  roles: readonly string[] | undefined,
  allowedRoles: readonly string[],
): boolean => roles?.some(
  (role) => allowedRoles.includes(role.toLowerCase()),
) ?? false;
