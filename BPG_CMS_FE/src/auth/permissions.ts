export const SystemPermission = {
  UsersManage: 'system.users.manage',
  MasterDataManage: 'system.master-data.manage',
  ConfigurationManage: 'system.configuration.manage',
  ProjectsList: 'system.projects.list',
  ProjectsCreate: 'system.projects.create',
  ProjectsUpdate: 'system.projects.update',
  ProjectsChangeStatus: 'system.projects.change-status',
  ProjectMembersManage: 'system.project-members.manage',
  SuppliersView: 'system.suppliers.view',
  SuppliersManage: 'system.suppliers.manage',
  ProcurementManage: 'system.procurement.manage',
  ReportsView: 'system.reports.view',
  FilesDelete: 'system.files.delete',
} as const;

export const ProjectPermission = {
  View: 'project.view',
  ExecutionManage: 'project.execution.manage',
  TechnicalManage: 'project.technical.manage',
  AccountingManage: 'project.accounting.manage',
  InventoryManage: 'project.inventory.manage',
  Approve: 'project.approve',
  ReportsView: 'project.reports.view',
} as const;

export type SystemPermissionValue =
  (typeof SystemPermission)[keyof typeof SystemPermission];
export type ProjectPermissionValue =
  (typeof ProjectPermission)[keyof typeof ProjectPermission];

export const PROJECT_PERMISSION_LABELS: Record<ProjectPermissionValue, string> = {
  [ProjectPermission.View]: 'Xem dự án',
  [ProjectPermission.ExecutionManage]: 'Điều hành thi công',
  [ProjectPermission.TechnicalManage]: 'Quản lý kỹ thuật và thành viên',
  [ProjectPermission.AccountingManage]: 'Nghiệp vụ kế toán',
  [ProjectPermission.InventoryManage]: 'Quản lý kho',
  [ProjectPermission.Approve]: 'Phê duyệt cấp giám đốc',
  [ProjectPermission.ReportsView]: 'Xem báo cáo dự án',
};

const ALL_SYSTEM_PERMISSIONS = Object.values(SystemPermission);
const ALL_PROJECT_PERMISSIONS = Object.values(ProjectPermission);

const SYSTEM_GRANTS: Record<string, readonly SystemPermissionValue[]> = {
  admin: ALL_SYSTEM_PERMISSIONS,
  director: [
    SystemPermission.ProjectsList,
    SystemPermission.ProjectsChangeStatus,
    SystemPermission.SuppliersView,
    SystemPermission.ProcurementManage,
    SystemPermission.ReportsView,
  ],
  technicalmanager: [
    SystemPermission.ProjectsList,
    SystemPermission.ProjectsCreate,
    SystemPermission.ProjectsUpdate,
    SystemPermission.ProjectsChangeStatus,
    SystemPermission.ProjectMembersManage,
    SystemPermission.SuppliersView,
    SystemPermission.SuppliersManage,
    SystemPermission.ProcurementManage,
    SystemPermission.ReportsView,
    SystemPermission.FilesDelete,
  ],
  accountant: [
    SystemPermission.ProjectsList,
    SystemPermission.SuppliersView,
    SystemPermission.SuppliersManage,
    SystemPermission.ProcurementManage,
    SystemPermission.ReportsView,
  ],
  siteengineer: [
    SystemPermission.ProjectsList,
    SystemPermission.SuppliersView,
  ],
};

const GLOBAL_PROJECT_GRANTS: Record<string, readonly ProjectPermissionValue[]> = {
  admin: ALL_PROJECT_PERMISSIONS,
  director: [
    ProjectPermission.View,
    ProjectPermission.InventoryManage,
    ProjectPermission.Approve,
    ProjectPermission.ReportsView,
  ],
  technicalmanager: [
    ProjectPermission.View,
    ProjectPermission.ExecutionManage,
    ProjectPermission.TechnicalManage,
    ProjectPermission.InventoryManage,
    ProjectPermission.ReportsView,
  ],
  accountant: [
    ProjectPermission.View,
    ProjectPermission.AccountingManage,
    ProjectPermission.InventoryManage,
    ProjectPermission.ReportsView,
  ],
};

export const getSystemPermissionsForRoles = (
  roles: readonly string[],
): SystemPermissionValue[] => {
  const permissions = new Set<SystemPermissionValue>();
  roles.forEach((role) => {
    SYSTEM_GRANTS[role.toLowerCase()]?.forEach((permission) => {
      permissions.add(permission);
    });
  });
  return [...permissions].sort();
};

export const getBaselineProjectPermissions = (
  roles: readonly string[],
  isMember: boolean,
  isLeader: boolean,
): ProjectPermissionValue[] => {
  const permissions = new Set<ProjectPermissionValue>();
  roles.forEach((role) => {
    GLOBAL_PROJECT_GRANTS[role.toLowerCase()]?.forEach((permission) => {
      permissions.add(permission);
    });
  });

  if (isMember) {
    permissions.add(ProjectPermission.View);
  }
  if (isLeader) {
    permissions.add(ProjectPermission.ExecutionManage);
    permissions.add(ProjectPermission.InventoryManage);
  }

  return [...permissions].sort();
};

export const hasPermission = (
  permissions: readonly string[] | undefined,
  permission: string,
): boolean => permissions?.some(
  (candidate) => candidate.toLowerCase() === permission.toLowerCase(),
) ?? false;
