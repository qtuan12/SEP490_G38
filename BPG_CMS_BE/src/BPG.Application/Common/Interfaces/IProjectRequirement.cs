using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;

namespace BPG.Application.Common.Interfaces;

/// <summary>
/// Gắn interface này vào các Query cần kiểm soát quyền truy cập theo dự án.
/// Thay vì dùng reflection, mỗi Query tự implement <see cref="GetProjectIdAsync"/>
/// để trả về ProjectId tương ứng (trực tiếp hoặc qua join DB).
/// ProjectAuthorizationBehavior sẽ gọi method này trước khi chạy Handler.
/// </summary>
public interface IProjectRequirement
{
    string RequiredPermission => ProjectPermission.View;

    /// <summary>
    /// Trả về ProjectId của query. Throw <c>NotFoundException</c> nếu không xác định được
    /// (vd. FK nullable bị null hoặc entity không tồn tại) để fail-closed.
    /// </summary>
    Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken);
}

/// <summary>
/// Used by requests that support both a project-scoped endpoint and a separately
/// authorized system-wide endpoint.
/// </summary>
public interface IProjectScopedListRequest
{
    string RequiredPermission => ProjectPermission.View;

    Task<long?> GetProjectIdAsync(
        IUnitOfWork unitOfWork,
        CancellationToken cancellationToken);
}
