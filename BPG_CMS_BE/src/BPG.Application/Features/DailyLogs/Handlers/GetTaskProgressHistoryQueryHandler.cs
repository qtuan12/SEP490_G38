using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DailyLogs.Handlers
{
    public class GetTaskProgressHistoryQueryHandler : IRequestHandler<GetTaskProgressHistoryQuery, List<TaskProgressLogDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetTaskProgressHistoryQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<List<TaskProgressLogDto>> Handle(GetTaskProgressHistoryQuery request, CancellationToken cancellationToken)
        {
            var task = await _uow.Repository<ProjectTask>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, cancellationToken);

            if (task == null)
            {
                throw new NotFoundException(nameof(ProjectTask), request.TaskId);
            }

            var logs = await _uow.Repository<TaskProgressLog>().Query()
                .AsNoTracking()
                .Include(tpl => tpl.Creator)       // CreatedBy → User (thủ công / realtime)
                .Where(tpl => tpl.TaskId == request.TaskId)
                .OrderByDescending(tpl => tpl.CreatedAt != default ? tpl.CreatedAt : tpl.UpdatedAt)
                .ToListAsync(cancellationToken);

            // Lấy thêm User theo UpdatedBy cho các auto-sync log (CreatedBy có thể null nếu log cũ)
            var updatedByIds = logs
                .Where(l => l.Creator == null && l.UpdatedBy.HasValue)
                .Select(l => l.UpdatedBy!.Value)
                .Distinct()
                .ToList();

            Dictionary<long, string> updatedByNames = new();
            if (updatedByIds.Any())
            {
                updatedByNames = await _uow.Repository<User>().Query()
                    .AsNoTracking()
                    .Where(u => updatedByIds.Contains(u.UserId))
                    .ToDictionaryAsync(u => u.UserId, u => u.FullName ?? u.Email, cancellationToken);
            }

            return logs.Select(log =>
            {
                string? displayName = null;
                if (log.Creator != null)
                {
                    // Ưu tiên 1: Creator (người trực tiếp sửa)
                    displayName = log.Creator.FullName ?? log.Creator.Email;
                }
                else if (log.UpdatedBy.HasValue && updatedByNames.TryGetValue(log.UpdatedBy.Value, out var updByName))
                {
                    // Ưu tiên 2: UpdatedBy (người trigger auto-sync)
                    displayName = updByName;
                }
                else if (!string.IsNullOrEmpty(log.UpdateReason) && log.UpdateReason.Contains("Cập nhật tự động"))
                {
                    // Ưu tiên 3: Log auto-sync không có user (data cũ)
                    displayName = "Hệ thống (Tự động)";
                }
                else
                {
                    displayName = null; // FE sẽ hiện trống hoặc icon hệ thống
                }

                return new TaskProgressLogDto
                {
                    TaskProgressLogId = log.TaskProgressLogId,
                    TaskId = log.TaskId,
                    OldProgress = log.OldProgress,
                    NewProgress = log.NewProgress,
                    UpdateReason = log.UpdateReason,
                    UpdatedAt = log.UpdatedAt ?? log.CreatedAt,
                    CreatedBy = log.CreatedBy,
                    UpdatedByName = displayName
                };
            }).ToList();
        }
    }
}
