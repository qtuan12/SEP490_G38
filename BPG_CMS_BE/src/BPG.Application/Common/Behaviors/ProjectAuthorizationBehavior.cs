using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Common.Interfaces;
using BPG.Application.IServices;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
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

            if (projectId <= 0)
            {
                // Không xác định được dự án -> không cấp quyền (fail-closed).
                throw new ForbiddenException("Không xác định được dự án để kiểm tra quyền truy cập.");
            }

            var currentUserId = _currentUserService.UserId;
            if (currentUserId == null)
                throw new UnauthorizedException();

            bool isDirector = _currentUserService.IsInRole(RoleConstants.Director);
            bool isTechnicalManager = _currentUserService.IsInRole(RoleConstants.TechnicalManager);
            bool isAccountant = _currentUserService.IsInRole(RoleConstants.Accountant);

            // 1. Kiểm tra các nhóm quyền chuyên biệt (Marker Interfaces)
            if (request is IRequireTechnicalManager && !isTechnicalManager && !isDirector)
            {
                throw new ForbiddenException("Chỉ Trưởng phòng kỹ thuật hoặc Giám đốc mới có quyền thực hiện chức năng này.");
            }

            if (request is IRequireAccountant && !isAccountant && !isDirector)
            {
                throw new ForbiddenException("Chỉ Kế toán hoặc Giám đốc mới có quyền thực hiện chức năng này.");
            }

            if (request is IRequireProjectLeader)
            {
                if (isDirector || isTechnicalManager)
                {
                    return await next();
                }

                var leaderMember = await _unitOfWork.Repository<ProjectMember>().Query().FirstOrDefaultAsync(
                    m => m.ProjectId == projectId && m.UserId == currentUserId.Value,
                    cancellationToken);

                if (leaderMember == null || !leaderMember.IsLeader)
                {
                    throw new ForbiddenException("Chỉ Trưởng dự án mới có quyền thực hiện chức năng này.");
                }

                return await next();
            }

            // 2. Nhóm quyền cao: cho qua luôn, không check thành viên đối với các Query/Command thường
            if (isDirector || isTechnicalManager || isAccountant)
            {
                return await next();
            }

            // 3. Các vai trò còn lại: phải là thành viên của dự án mới được truy cập
            var isMember = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                m => m.ProjectId == projectId && m.UserId == currentUserId.Value,
                cancellationToken);

            if (!isMember)
                throw new ForbiddenException("Bạn không thuộc dự án này nên không có quyền xem dữ liệu.");
        }

        return await next();
    }
}
