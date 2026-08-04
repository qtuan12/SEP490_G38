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
                .Include(tpl => tpl.Creator)
                .Where(tpl => tpl.TaskId == request.TaskId)
                .OrderByDescending(tpl => tpl.CreatedAt != default ? tpl.CreatedAt : tpl.UpdatedAt)
                .ToListAsync(cancellationToken);

            return logs.Select(log => new TaskProgressLogDto
            {
                TaskProgressLogId = log.TaskProgressLogId,
                TaskId = log.TaskId,
                OldProgress = log.OldProgress,
                NewProgress = log.NewProgress,
                UpdateReason = log.UpdateReason,
                UpdatedAt = log.UpdatedAt ?? log.CreatedAt,
                CreatedBy = log.CreatedBy,
                UpdatedByName = log.Creator != null 
                    ? log.Creator.FullName 
                    : (!string.IsNullOrEmpty(log.UpdateReason) && log.UpdateReason.Contains("Cập nhật tự động") 
                        ? "Hệ thống (Tự động)" 
                        : "Kỹ sư hiện trường")
            }).ToList();
        }
    }
}
