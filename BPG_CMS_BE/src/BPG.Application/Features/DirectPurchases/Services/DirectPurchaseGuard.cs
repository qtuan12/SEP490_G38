using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.DirectPurchases.Services
{
    internal static class DirectPurchaseGuard
    {
        /// <summary>
        /// Technical Manager, hoặc Trưởng dự án của chính dự án đó, được thao tác phiếu mua trực tiếp.
        /// </summary>
        public static async Task EnsureCanManageAsync(
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            long projectId,
            long userId,
            CancellationToken ct)
        {
            if (currentUser.IsInRole(UserRole.TechnicalManager)) return;

            var isProjectLeader = await uow.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == projectId && member.UserId == userId && member.IsLeader,
                ct);

            if (!isProjectLeader)
                throw new ForbiddenException(
                    "Chỉ Technical Manager hoặc Trưởng dự án được lập và gửi phiếu mua khẩn cấp của dự án này.");
        }
    }
}
