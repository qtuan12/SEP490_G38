using BPG.Domain.Constants;

namespace BPG.Application.Common.Authorization;

internal static class PermissionGrantCatalog
{
    private static readonly HashSet<string> AllSystem =
        new(PermissionCatalog.SystemPermissions, StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> AllProject =
        new(PermissionCatalog.ProjectPermissions, StringComparer.OrdinalIgnoreCase);

    private static readonly IReadOnlyDictionary<string, HashSet<string>> SystemGrants =
        new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [UserRole.Admin] = AllSystem,
            [UserRole.Director] = Set(
                SystemPermission.ProjectsList,
                SystemPermission.ProjectsChangeStatus,
                SystemPermission.SuppliersView,
                SystemPermission.ProcurementManage,
                SystemPermission.ReportsView),
            [UserRole.TechnicalManager] = Set(
                SystemPermission.ProjectsList,
                SystemPermission.ProjectsCreate,
                SystemPermission.ProjectsUpdate,
                SystemPermission.ProjectsChangeStatus,
                SystemPermission.ProjectMembersManage,
                SystemPermission.SuppliersView,
                SystemPermission.SuppliersManage,
                SystemPermission.ProcurementManage,
                SystemPermission.ReportsView,
                SystemPermission.FilesDelete),
            [UserRole.Accountant] = Set(
                SystemPermission.ProjectsList,
                SystemPermission.SuppliersView,
                SystemPermission.SuppliersManage,
                SystemPermission.ProcurementManage,
                SystemPermission.ReportsView),
            [UserRole.SiteEngineer] = Set(
                SystemPermission.ProjectsList,
                SystemPermission.SuppliersView)
        };

    private static readonly IReadOnlyDictionary<string, HashSet<string>> GlobalProjectGrants =
        new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [UserRole.Admin] = AllProject,
            [UserRole.Director] = Set(
                ProjectPermission.View,
                ProjectPermission.InventoryManage,
                ProjectPermission.Approve,
                ProjectPermission.ReportsView),
            [UserRole.TechnicalManager] = Set(
                ProjectPermission.View,
                ProjectPermission.ExecutionManage,
                ProjectPermission.TechnicalManage,
                ProjectPermission.InventoryManage,
                ProjectPermission.ReportsView),
            [UserRole.Accountant] = Set(
                ProjectPermission.View,
                ProjectPermission.AccountingManage,
                ProjectPermission.InventoryManage,
                ProjectPermission.ReportsView)
        };

    private static readonly HashSet<string> MemberProjectGrants = Set(
        ProjectPermission.View);

    private static readonly HashSet<string> LeaderProjectGrants = Set(
        ProjectPermission.View,
        ProjectPermission.ExecutionManage,
        ProjectPermission.InventoryManage);

    public static IReadOnlyCollection<string> GetSystemPermissions(IEnumerable<string> roles) =>
        Combine(roles, SystemGrants);

    public static IReadOnlyCollection<string> GetGlobalProjectPermissions(IEnumerable<string> roles) =>
        Combine(roles, GlobalProjectGrants);

    public static IReadOnlyCollection<string> GetMemberProjectPermissions(bool isLeader) =>
        isLeader ? LeaderProjectGrants : MemberProjectGrants;

    public static IReadOnlyCollection<string> GetProjectPermissions(
        IEnumerable<string> roles,
        bool? isLeader)
    {
        var roleList = roles.ToList();
        if (roleList.Contains(UserRole.Admin, StringComparer.OrdinalIgnoreCase))
            return AllProject;

        var result = new HashSet<string>(
            GetGlobalProjectPermissions(roleList),
            StringComparer.OrdinalIgnoreCase);

        if (isLeader.HasValue)
            result.UnionWith(GetMemberProjectPermissions(isLeader.Value));

        if (!result.Contains(ProjectPermission.View))
            result.Clear();

        return result;
    }

    private static IReadOnlyCollection<string> Combine(
        IEnumerable<string> roles,
        IReadOnlyDictionary<string, HashSet<string>> grants)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var role in roles)
        {
            if (grants.TryGetValue(role, out var roleGrants))
                result.UnionWith(roleGrants);
        }

        return result;
    }

    private static HashSet<string> Set(params string[] permissions) =>
        new(permissions, StringComparer.OrdinalIgnoreCase);
}
