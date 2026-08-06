using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using RoleNames = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.Users.Services
{
    /// <summary>
    /// Chốt chặn dùng chung cho xóa và khóa tài khoản. Hai thao tác này khác nhau về hình thức
    /// nhưng hậu quả giống nhau: người đó không đăng nhập và không thao tác được nữa, nên các
    /// điều kiện gây kẹt hệ thống phải kiểm như nhau.
    /// </summary>
    internal static class UserGuard
    {
        /// <summary>Không cho tự vô hiệu hóa chính mình — dễ tự khóa mình ra khỏi hệ thống do nhầm dòng.</summary>
        public static void EnsureNotSelf(long targetUserId, long currentUserId, string action)
        {
            if (targetUserId == currentUserId)
                throw new BusinessException(ErrorCodes.UserCannotDeleteSelf,
                    $"Không thể {action} chính tài khoản bạn đang đăng nhập.");
        }

        /// <summary>
        /// Phải luôn còn ít nhất một Quản trị viên hoạt động: mọi endpoint quản lý tài khoản đều
        /// yêu cầu role Admin, mất người cuối cùng là không còn đường sửa từ giao diện.
        /// </summary>
        public static async Task EnsureNotLastAdminAsync(
            IUnitOfWork uow, long targetUserId, string action, CancellationToken ct)
        {
            var isAdmin = await HasRoleAsync(uow, targetUserId, RoleNames.Admin, ct);
            if (!isAdmin) return;

            var otherAdmins = await CountOtherActiveUsersInRoleAsync(uow, targetUserId, RoleNames.Admin, ct);
            if (otherAdmins == 0)
                throw new BusinessException(ErrorCodes.UserLastAdmin,
                    $"Đây là Quản trị viên duy nhất còn hoạt động. {char.ToUpper(action[0])}{action[1..]} tài khoản này " +
                    "sẽ khiến không ai còn quyền quản lý người dùng. Hãy cấp quyền Quản trị viên cho người khác trước.");
        }

        /// <summary>
        /// Trưởng dự án là vai trò duy nhất được thao tác nhiều nghiệp vụ trong phạm vi dự án,
        /// gỡ người đang giữ vai trò này mà chưa bàn giao thì dự án đứng.
        /// </summary>
        public static async Task EnsureNotLeadingActiveProjectAsync(
            IUnitOfWork uow, long targetUserId, string action, CancellationToken ct)
        {
            var projectNames = await uow.Repository<ProjectMember>().Query()
                .AsNoTracking()
                .Where(m => m.UserId == targetUserId
                         && m.IsLeader
                         && m.Project.Status != ProjectStatus.Closed
                         && m.Project.Status != ProjectStatus.Completed)
                .Select(m => m.Project.Name)
                .ToListAsync(ct);

            if (projectNames.Count == 0) return;

            throw new BusinessException(ErrorCodes.UserIsProjectLeader,
                $"Tài khoản đang là trưởng dự án của: {string.Join(", ", projectNames)}. " +
                $"Hãy bàn giao vai trò trưởng dự án cho người khác trước khi {action}.");
        }

        /// <summary>
        /// Chặn trường hợp gỡ mất người duyệt cuối cùng trong khi hàng chờ còn phiếu: phiếu sẽ
        /// kẹt vĩnh viễn vì endpoint duyệt chỉ mở cho đúng role đó.
        /// </summary>
        public static async Task EnsureNotLastApproverWithPendingWorkAsync(
            IUnitOfWork uow, long targetUserId, string action, CancellationToken ct)
        {
            if (await HasRoleAsync(uow, targetUserId, RoleNames.Director, ct)
                && await CountOtherActiveUsersInRoleAsync(uow, targetUserId, RoleNames.Director, ct) == 0)
            {
                var pending = new List<string>();

                var poCount = await uow.Repository<PurchaseOrder>().Query()
                    .CountAsync(po => po.Status == PurchaseOrderStatus.PendingApproval, ct);
                if (poCount > 0) pending.Add($"{poCount} đơn mua hàng chờ duyệt");

                var dpCount = await uow.Repository<DirectPurchaseRequest>().Query()
                    .CountAsync(dp => dp.Status == DirectPurchaseStatus.WaitingApproval, ct);
                if (dpCount > 0) pending.Add($"{dpCount} phiếu mua khẩn cấp chờ duyệt chi");

                var mrCount = await uow.Repository<MaterialRequest>().Query()
                    .CountAsync(mr => mr.Status == MaterialRequestStatus.WaitingApproval, ct);
                if (mrCount > 0) pending.Add($"{mrCount} yêu cầu vật tư chờ duyệt");

                ThrowIfPending(pending, "Giám đốc", action);
            }

            if (await HasRoleAsync(uow, targetUserId, RoleNames.Accountant, ct)
                && await CountOtherActiveUsersInRoleAsync(uow, targetUserId, RoleNames.Accountant, ct) == 0)
            {
                var pending = new List<string>();

                var dpAuditCount = await uow.Repository<DirectPurchaseRequest>().Query()
                    .CountAsync(dp => dp.Status == DirectPurchaseStatus.Pending, ct);
                if (dpAuditCount > 0) pending.Add($"{dpAuditCount} phiếu mua khẩn cấp chờ soát hóa đơn");

                ThrowIfPending(pending, "Kế toán", action);
            }
        }

        private static void ThrowIfPending(List<string> pending, string roleLabel, string action)
        {
            if (pending.Count == 0) return;

            throw new BusinessException(ErrorCodes.UserLastApprover,
                $"Đây là {roleLabel} duy nhất còn hoạt động, trong khi hệ thống còn {string.Join(", ", pending)}. " +
                $"Những phiếu này sẽ không còn ai duyệt được. Hãy xử lý hết hoặc bổ sung người giữ vai trò {roleLabel} trước khi {action}.");
        }

        private static async Task<bool> HasRoleAsync(
            IUnitOfWork uow, long userId, string roleName, CancellationToken ct) =>
            await uow.Repository<Domain.Entities.UserRole>().Query()
                .AsNoTracking()
                .AnyAsync(ur => ur.UserId == userId && ur.Role.RoleName == roleName, ct);

        /// <summary>Đếm người khác còn hoạt động giữ cùng role. Tài khoản đã xóa mềm bị query filter loại sẵn.</summary>
        private static async Task<int> CountOtherActiveUsersInRoleAsync(
            IUnitOfWork uow, long excludeUserId, string roleName, CancellationToken ct) =>
            await uow.Repository<Domain.Entities.UserRole>().Query()
                .AsNoTracking()
                .CountAsync(ur => ur.UserId != excludeUserId
                               && ur.Role.RoleName == roleName
                               && ur.User.IsActive, ct);

    }
}
