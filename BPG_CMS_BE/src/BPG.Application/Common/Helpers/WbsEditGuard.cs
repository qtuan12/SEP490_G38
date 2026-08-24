using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace BPG.Application.Common.Helpers;

/// <summary>
/// Kiểm tra xem dự án có được phép chỉnh sửa WBS (Phase/Task) hay không.
/// Điều kiện bình thường: dự án đang ở trạng thái Draft hoặc InProgress.
/// Ngoại lệ khẩn cấp: dự án đang Paused nhưng có sự cố khẩn cấp đã được
/// Giám đốc phê duyệt (IsEmergency = true, Status = "Approved") — cho phép
/// Trưởng phòng Kỹ thuật lập lại kế hoạch WBS mà không cần kích hoạt lại dự án trước.
/// </summary>
public static class WbsEditGuard
{
    /// <summary>
    /// Kiểm tra trạng thái dự án khi đã có sẵn project status.
    /// Nếu là Draft hoặc InProgress thì cho phép ngay lập tức (không cần truy vấn thêm).
    /// Nếu là Paused thì kiểm tra tiếp xem có sự cố khẩn cấp được duyệt hay không.
    /// </summary>
    public static async Task EnsureProjectAllowsWbsEditAsync(
        IUnitOfWork uow,
        long projectId,
        string? projectStatus,
        string? projectPauseReason,
        CancellationToken ct,
        ICurrentUserService? currentUserService = null)
    {
        if (projectStatus == ProjectStatus.Draft || projectStatus == ProjectStatus.InProgress)
            return;

        if (projectStatus == ProjectStatus.Paused)
        {
            if (currentUserService != null
                && !currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
            {
                throw new ForbiddenException(
                    "Chỉ Trưởng phòng Kỹ thuật được chỉnh sửa WBS trong khi dự án tạm dừng để khắc phục sự cố khẩn cấp.");
            }

            var currentEmergencyIncidentId = GetCurrentPauseEmergencyIncidentId(projectPauseReason);
            if (currentEmergencyIncidentId.HasValue)
            {
                var hasApprovedEmergency = await uow.Repository<Incident>()
                    .Query()
                    .AsNoTracking()
                    .AnyAsync(i =>
                        i.IncidentId == currentEmergencyIncidentId.Value &&
                        i.ProjectId == projectId &&
                        i.IsEmergency &&
                        i.Status == IncidentStatus.Approved,
                        ct);

                if (hasApprovedEmergency)
                    return;
            }
        }

        throw new BusinessException(
            ErrorCodes.InvalidTransition,
            "Dự án phải ở trạng thái Nháp hoặc Đang hoạt động để thực hiện thao tác này.");
    }

    /// <summary>
    /// Kiểm tra trạng thái dự án khi chỉ có projectId (tự truy vấn project status từ DB).
    /// </summary>
    public static async Task EnsureProjectAllowsWbsEditAsync(
        IUnitOfWork uow,
        long projectId,
        CancellationToken ct)
    {
        var projectRepo = uow.Repository<Project>();
        if (projectRepo == null)
            return;

        var project = await projectRepo
            .Query()
            .AsNoTracking()
            .Select(p => new { p.ProjectId, p.Status, p.PauseReason })
            .FirstOrDefaultAsync(p => p.ProjectId == projectId, ct);

        if (project == null)
            return; // Caller xử lý NotFoundException

        await EnsureProjectAllowsWbsEditAsync(
            uow, projectId, project.Status, project.PauseReason, ct);
    }

    private static long? GetCurrentPauseEmergencyIncidentId(string? pauseReason)
    {
        if (string.IsNullOrWhiteSpace(pauseReason))
            return null;

        try
        {
            var history = JsonNode.Parse(pauseReason) as JsonArray;
            var lastItem = history?.LastOrDefault();
            var type = lastItem?["type"]?.GetValue<string>()
                ?? lastItem?["Type"]?.GetValue<string>();

            if (!string.Equals(type, "pause", StringComparison.OrdinalIgnoreCase))
                return null;

            var incidentIdNode = lastItem?["emergencyIncidentId"]
                ?? lastItem?["EmergencyIncidentId"];
            return long.TryParse(incidentIdNode?.ToString(), out var incidentId)
                ? incidentId
                : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }
}
