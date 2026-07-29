namespace BPG.Application.IServices;

public interface IProjectAccessService
{
    Task<IReadOnlySet<long>> GetAccessibleProjectIdsAsync(CancellationToken ct = default);
    Task<bool> IsCurrentUserProjectMemberAsync(long projectId, CancellationToken ct = default);
    Task<bool> IsCurrentUserProjectLeaderAsync(long projectId, CancellationToken ct = default);
}
