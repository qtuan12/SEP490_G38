using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
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

        /// <summary>
        /// Chặn soạn thảo phiếu mới trên dự án/giai đoạn đã đóng.
        ///
        /// Phản chiếu đúng điều kiện của <see cref="Handlers.SubmitDirectPurchaseCommandHandler"/>:
        /// nếu không kiểm ở khâu soạn, người dùng vẫn nhập được cả phiếu rồi mới bị chặn ở bước Gửi.
        ///
        /// CHỈ áp cho tạo/sửa nháp. Không áp cho xóa nháp và các bước duyệt chi phía sau —
        /// xem ghi chú ở từng handler.
        /// </summary>
        public static async Task EnsureProjectOpenForDraftingAsync(
            IUnitOfWork uow, long projectId, Phase phase, CancellationToken ct)
        {
            var project = await uow.Repository<Project>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.ProjectId == projectId, ct)
                ?? throw new NotFoundException("Không tìm thấy dự án của phiếu mua trực tiếp.");

            if (project.Status != ProjectStatus.InProgress)
                throw new BusinessException(ErrorCodes.DpProjectNotActive,
                    $"Dự án '{project.Name}' đang ở trạng thái '{project.Status}', không ở trạng thái Đang thi công " +
                    "nên không thể lập hoặc sửa phiếu mua khẩn cấp.");

            if (phase.Status == PhaseStatus.Approved)
                throw new BusinessException(ErrorCodes.DpPhaseFrozen,
                    $"Giai đoạn '{phase.Name}' đã được nghiệm thu và đóng băng, không thể lập hoặc sửa phiếu mua khẩn cấp.");
        }
    }
}
