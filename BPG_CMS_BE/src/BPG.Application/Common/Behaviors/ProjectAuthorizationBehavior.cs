using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Common.Interfaces;
using BPG.Application.IServices;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Common.Behaviors;

/// <summary>
/// Behavior kiểm soát quyền truy cập dữ liệu theo dự án cho các Query.
///
/// Quy tắc:
/// - Nhóm quyền cao (Admin, Giám đốc, Trưởng phòng kỹ thuật, Kế toán):
///   được xem mọi dự án, bỏ qua kiểm tra thành viên.
/// - SiteEngineer, ProjectLeader và các vai trò khác:
///   chỉ được xem khi nằm trong danh sách ProjectMember của dự án đó.
///
/// Cách dùng: cho Query implement IProjectRequirement (có method GetProjectIdAsync),
/// behavior sẽ gọi GetProjectIdAsync để lấy ProjectId rồi kiểm tra quyền thành viên.
/// </summary>
public class ProjectAuthorizationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    // Vai trò được phép xem toàn bộ dự án mà không cần là thành viên.
    private static readonly string[] FullAccessRoles =
    {
        RoleConstants.Admin,
        RoleConstants.Director,
        RoleConstants.TechnicalManager,
        RoleConstants.Accountant
    };

    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;

    public ProjectAuthorizationBehavior(ICurrentUserService currentUserService, IUnitOfWork unitOfWork)
    {
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is IProjectRequirement projectRequest)
        {
            var projectId = await projectRequest.GetProjectIdAsync(_unitOfWork, cancellationToken);

            var currentUserId = _currentUserService.UserId;
            if (currentUserId == null)
                throw new UnauthorizedException();

            // 1. Nhóm quyền cao: cho qua luôn, kể cả khi không giới hạn theo 1 dự án cụ thể
            //    (projectId <= 0 nghĩa là request muốn xem dữ liệu của TẤT CẢ dự án).
            if (_currentUserService.IsInAnyRole(FullAccessRoles))
                return await next();

            if (projectId <= 0)
            {
                // Role không có full-access mà không xác định được dự án -> không cấp quyền (fail-closed).
                throw new ForbiddenException("Không xác định được dự án để kiểm tra quyền truy cập.");
            }

            // 2. Các vai trò còn lại: phải là thành viên của dự án mới được xem.
            var isMember = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                m => m.ProjectId == projectId && m.UserId == currentUserId.Value,
                cancellationToken);

            if (!isMember)
                throw new ForbiddenException("Bạn không thuộc dự án này nên không có quyền xem dữ liệu.");
        }

        return await next();
    }
}
