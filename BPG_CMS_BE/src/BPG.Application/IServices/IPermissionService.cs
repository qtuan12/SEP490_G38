namespace BPG.Application.IServices;

public interface IPermissionService
{
    bool HasSystemPermission(string permission);
    IReadOnlyList<string> GetSystemPermissions();
    Task<bool> HasProjectPermissionAsync(long projectId, string permission, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetProjectPermissionsAsync(long projectId, CancellationToken ct = default);
    Task<IReadOnlySet<long>> GetProjectIdsWithPermissionAsync(string permission, CancellationToken ct = default);
}
