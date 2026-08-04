using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DailyLogs.Handlers
{
    public class GetDailyLogsQueryHandler : IRequestHandler<GetDailyLogsQuery, PagedList<DailyLogDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetDailyLogsQueryHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<PagedList<DailyLogDto>> Handle(GetDailyLogsQuery request, CancellationToken cancellationToken)
        {
            // Query các DailyLog thuộc dự án
            var query = _uow.Repository<DailyLog>().Query()
                .AsNoTracking()
                .AsSplitQuery()
                .Include(d => d.Task)
                .Include(d => d.Creator)
                .Include(d => d.Comments)
                    .ThenInclude(c => c.Author)
                        .ThenInclude(u => u.UserRoles)
                            .ThenInclude(ur => ur.Role)
                .Where(d => d.Task.Phase.ProjectId == request.ProjectId);

            if (request.TaskId.HasValue)
            {
                // Lấy cấu trúc cây task của toàn dự án để BFS tìm con/cháu
                // Không filter status/isDeleted vì chỉ cần quan hệ ParentTaskId
                var allTasks = await _uow.Repository<ProjectTask>().Query()
                    .AsNoTracking()
                    .Where(t => t.Phase.ProjectId == request.ProjectId)
                    .Select(t => new { t.TaskId, t.ParentTaskId })
                    .ToListAsync(cancellationToken);

                var taskIdsToFilter = new List<long> { request.TaskId.Value };
                
                // Thuật toán tìm tất cả các task con cháu đệ quy (BFS)
                var queue = new Queue<long>();
                queue.Enqueue(request.TaskId.Value);
                while (queue.Count > 0)
                {
                    var currentId = queue.Dequeue();
                    var children = allTasks.Where(t => t.ParentTaskId == currentId).Select(t => t.TaskId).ToList();
                    foreach (var childId in children)
                    {
                        if (!taskIdsToFilter.Contains(childId))
                        {
                            taskIdsToFilter.Add(childId);
                            queue.Enqueue(childId);
                        }
                    }
                }

                query = query.Where(d => taskIdsToFilter.Contains(d.TaskId));
            }

            if (request.CreatedBy.HasValue)
            {
                query = query.Where(d => d.CreatedBy == request.CreatedBy.Value);
            }

            if (request.LogDate.HasValue)
            {
                query = query.Where(d => d.LogDate == request.LogDate.Value);
            }

            // Sắp xếp theo ngày tạo mới nhất
            query = query.OrderByDescending(d => d.LogDate).ThenByDescending(d => d.CreatedAt);

            // Phân trang
            var pagedEntities = await query.ToPagedListAsync(request, cancellationToken);

            // Ánh xạ sang DTO
            var dtos = _mapper.Map<List<DailyLogDto>>(pagedEntities.Items);

            if (request.LogId.HasValue && !dtos.Any(d => d.LogId == request.LogId.Value))
            {
                var targetLogEntity = await _uow.Repository<DailyLog>().Query()
                    .AsNoTracking()
                    .AsSplitQuery()
                    .Include(d => d.Task)
                    .Include(d => d.Creator)
                    .Include(d => d.Comments)
                        .ThenInclude(c => c.Author)
                            .ThenInclude(u => u.UserRoles)
                                .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(d => d.LogId == request.LogId.Value, cancellationToken);

                if (targetLogEntity != null)
                {
                    var targetDto = _mapper.Map<DailyLogDto>(targetLogEntity);
                    dtos.Insert(0, targetDto);
                }
            }

            if (dtos.Any())
            {
                var logIds = dtos.Select(d => d.LogId).ToList();
                var taskIds = dtos.Select(d => d.TaskId).Distinct().ToList();

                // Lấy cấu hình số giờ được phép chỉnh sửa nhật ký (mặc định 24h)
                var editWindowConfig = await _uow.Repository<SystemConfig>().Query()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.DailyLogEditWindowHours, cancellationToken);
                int editWindowHours = editWindowConfig != null && int.TryParse(editWindowConfig.ConfigValue, out var parsedHours) && parsedHours > 0
                    ? parsedHours
                    : 24;

                // Lấy tất cả progress logs của các Task này
                var progressLogs = await _uow.Repository<TaskProgressLog>().Query()
                    .AsNoTracking()
                    .Where(tpl => taskIds.Contains(tpl.TaskId))
                    .ToListAsync(cancellationToken);

                // Lấy tất cả ảnh đính kèm (Attachments) của các DailyLog này
                var attachments = await _uow.Repository<Attachment>().Query()
                    .AsNoTracking()
                    .Where(a => a.EntityType == EntityType.DailyLog && logIds.Contains(a.EntityId) && !a.IsDeleted)
                    .ToListAsync(cancellationToken);

                // Gán ảnh vào DTO tương ứng
                var attachmentGroup = attachments.GroupBy(a => a.EntityId)
                    .ToDictionary(g => g.Key, g => g.Select(a => a.FileUrl).ToList());

                foreach (var dto in dtos)
                {
                    if (attachmentGroup.TryGetValue(dto.LogId, out var urls))
                    {
                        dto.Images = urls;
                    }

                    // Tìm OldProgress từ TaskProgressLog tương ứng với DailyLog này (khớp TaskId, NewProgress, CreatedBy)
                    var matchingLog = progressLogs
                        .Where(tpl => tpl.TaskId == dto.TaskId && tpl.NewProgress == dto.NewProgressPercent && tpl.CreatedBy == dto.CreatedBy)
                        .OrderBy(tpl => Math.Abs((tpl.CreatedAt - dto.CreatedAt).TotalSeconds))
                        .FirstOrDefault();

                    dto.OldProgressPercent = matchingLog?.OldProgress ?? 0;
                    dto.EditWindowHours = editWindowHours;

                    // CanEdit = still within the editable window (kept in sync with Update handler)
                    dto.CanEdit = DateTime.UtcNow <= dto.CreatedAt.AddHours(editWindowHours);
                }
            }

            return new PagedList<DailyLogDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
        }
    }
}
