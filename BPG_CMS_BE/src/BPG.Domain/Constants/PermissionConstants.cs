namespace BPG.Domain.Constants;

public static class SystemPermission
{
    public const string UsersManage = "system.users.manage";
    public const string MasterDataManage = "system.master-data.manage";
    public const string ConfigurationManage = "system.configuration.manage";
    public const string ProjectsList = "system.projects.list";
    public const string ProjectsCreate = "system.projects.create";
    public const string ProjectsUpdate = "system.projects.update";
    public const string ProjectsChangeStatus = "system.projects.change-status";
    public const string ProjectMembersManage = "system.project-members.manage";
    public const string SuppliersView = "system.suppliers.view";
    public const string SuppliersManage = "system.suppliers.manage";
    public const string ProcurementManage = "system.procurement.manage";
    public const string ReportsView = "system.reports.view";
    public const string FilesDelete = "system.files.delete";
}

public static class ProjectPermission
{
    public const string View = "project.view";
    public const string ExecutionManage = "project.execution.manage";
    public const string TechnicalManage = "project.technical.manage";
    public const string AccountingManage = "project.accounting.manage";
    public const string InventoryManage = "project.inventory.manage";
    public const string Approve = "project.approve";
    public const string ReportsView = "project.reports.view";
}

public static class PermissionCatalog
{
    public static readonly IReadOnlyList<string> SystemPermissions =
    [
        SystemPermission.UsersManage,
        SystemPermission.MasterDataManage,
        SystemPermission.ConfigurationManage,
        SystemPermission.ProjectsList,
        SystemPermission.ProjectsCreate,
        SystemPermission.ProjectsUpdate,
        SystemPermission.ProjectsChangeStatus,
        SystemPermission.ProjectMembersManage,
        SystemPermission.SuppliersView,
        SystemPermission.SuppliersManage,
        SystemPermission.ProcurementManage,
        SystemPermission.ReportsView,
        SystemPermission.FilesDelete
    ];

    public static readonly IReadOnlyList<string> ProjectPermissions =
    [
        ProjectPermission.View,
        ProjectPermission.ExecutionManage,
        ProjectPermission.TechnicalManage,
        ProjectPermission.AccountingManage,
        ProjectPermission.InventoryManage,
        ProjectPermission.Approve,
        ProjectPermission.ReportsView
    ];
}
