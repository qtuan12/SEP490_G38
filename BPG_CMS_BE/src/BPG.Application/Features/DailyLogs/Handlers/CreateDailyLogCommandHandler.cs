using AutoMapper;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DailyLogs.Handlers
{
    public class CreateDailyLogCommandHandler : IRequestHandler<CreateDailyLogCommand, DailyLogDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly IProgressRollupService _progressRollupService;

        public CreateDailyLogCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            INotificationService notificationService,
            IRealtimeNotificationSender realtimeSender,
            IProgressRollupService progressRollupService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
            _realtimeSender = realtimeSender;
            _progressRollupService = progressRollupService;
        }

        public async Task<DailyLogDto> Handle(CreateDailyLogCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra Task có tồn tại hay không
            var task = await _uow.Repository<ProjectTask>().Query()
                .Include(t => t.SubTasks)
                .Include(t => t.Phase)
                    .ThenInclude(p => p.Project)
                .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, cancellationToken);

            if (task == null)
            {
                throw new NotFoundException(nameof(ProjectTask), request.TaskId);
            }

            var project = task.Phase.Project;

            // 2. Kiểm tra quyền của User (Chỉ TM, Project Leader hoặc Assigned Engineer mới được tạo daily log)
            bool isTM = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.TechnicalManager);
            if (!isTM)
            {
                // Kiểm tra xem User có phải là Project Leader của dự án này không
                var isLeader = await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(m => m.ProjectId == project.ProjectId && m.UserId == currentUserId && m.IsLeader, cancellationToken);

                // Kiểm tra xem User có được gán vào công việc này không
                var isAssignee = await _uow.Repository<TaskAssignee>().Query()
                    .AnyAsync(ta => ta.TaskId == task.TaskId && ta.UserId == currentUserId, cancellationToken);

                if (!isLeader && !isAssignee)
                {
                    throw new ForbiddenException("Chỉ Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép tạo nhật ký thi công.");
                }
            }

            // 3. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // Kiểm tra xem công việc hoặc bất kỳ công việc cha nào có bị khóa (đã nghiệm thu) không
            var tempTask = task;
            while (tempTask != null)
            {
                if (tempTask.IsLocked)
                {
                    throw new BusinessException("ERR_TASK_LOCKED", $"Không thể cập nhật tiến độ vì công việc hoặc cấp cha [{tempTask.Name}] đã được nghiệm thu và khóa.");
                }
                if (tempTask.ParentTaskId.HasValue)
                {
                    tempTask = await _uow.Repository<ProjectTask>().Query()
                        .FirstOrDefaultAsync(t => t.TaskId == tempTask.ParentTaskId.Value, cancellationToken);
                }
                else
                {
                    tempTask = null;
                }
            }


            // 4. Kiểm tra xem Task có phải là Task cha (có subtasks) không
            if (task.SubTasks != null && task.SubTasks.Any(s => !s.IsDeleted))
            {
                throw new BusinessException("ERR_TASK_HAS_SUBTASKS", 
                    "Không thể cập nhật tiến độ thủ công cho công việc cha có chứa các công việc con.");
            }

            // 4.5. Kiểm tra điều kiện phụ thuộc (Finish-to-Start)
            if (request.NewProgressPercent > 0)
            {
                var incompletePredecessors = await _uow.Repository<TaskDependency>()
                    .Query()
                    .Include(td => td.Predecessor)
                    .Where(td => td.TaskId == task.TaskId 
                        && td.Predecessor.ProgressPercent < 100
                        && td.Predecessor.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
                    .ToListAsync(cancellationToken);

                if (incompletePredecessors.Any())
                {
                    // Tìm tất cả các ancestor IDs để loại trừ khỏi danh sách chặn
                    var ancestorIds = new System.Collections.Generic.HashSet<long>();
                    long? currentParentId = task.ParentTaskId;
                    while (currentParentId.HasValue)
                    {
                        ancestorIds.Add(currentParentId.Value);
                        var parent = await _uow.Repository<ProjectTask>()
                            .Query()
                            .Select(t => new { t.TaskId, t.ParentTaskId })
                            .FirstOrDefaultAsync(t => t.TaskId == currentParentId.Value, cancellationToken);
                        currentParentId = parent?.ParentTaskId;
                    }

                    var blockedPredecessors = incompletePredecessors
                        .Where(td => !ancestorIds.Contains(td.PredecessorTaskId))
                        .ToList();

                    if (blockedPredecessors.Any())
                    {
                        var names = string.Join(", ", blockedPredecessors.Select(td => td.Predecessor.Name));
                        throw new BusinessException("ERR_TASK_DEPENDENCY_BLOCKED",
                            $"Không thể cập nhật tiến độ. Các công việc tiên quyết chưa hoàn thành: {names}");
                    }
                }
            }

            // 5. Kiểm tra lùi tiến độ (chỉ Admin/TM được phép lùi tiến độ)
            byte oldProgress = task.ProgressPercent;
            if (request.NewProgressPercent < oldProgress)
            {
                if (!isTM)
                {
                    throw new BusinessException("ERR_DECREASE_PROGRESS_FORBIDDEN", 
                        "Chỉ Quản trị viên hoặc Trưởng phòng kỹ thuật mới có quyền giảm tiến độ công việc.");
                }

                if (string.IsNullOrWhiteSpace(request.Description))
                {
                    throw new BusinessException("ERR_DECREASE_PROGRESS_REASON_REQUIRED", 
                        "Vui lòng nhập lý do giảm tiến độ công việc.");
                }
            }

            // Bắt đầu một transaction để đảm bảo lưu dữ liệu nhất quán
            await _uow.BeginTransactionAsync(cancellationToken);

            try
            {
                // Giải quyết tranh chấp đồng thời khi nhiều kỹ sư báo cáo tiến độ cùng lúc cho cùng một dự án:
                // Sử dụng sp_getapplock của SQL Server ở cấp độ dự án trong suốt thời gian chạy transaction
                var lockResource = $"Project_WbsClimb_Lock_{project.ProjectId}";
                await _uow.ExecuteSqlAsync($"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction'", cancellationToken);

                // 6. Tạo DailyLog
                var log = new DailyLog
                {
                    TaskId = request.TaskId,
                    LogDate = DateOnly.FromDateTime(DateTime.Today),
                    NewProgressPercent = request.NewProgressPercent,
                    Description = request.Description,
                    CreatedBy = currentUserId,
                    CreatedAt = DateTime.UtcNow
                };

                await _uow.Repository<DailyLog>().AddAsync(log, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken); // Save để có LogId cho Attachments

                // 7. Lưu Attachments (hình ảnh)
                if (request.Images != null && request.Images.Any())
                {
                    var attachments = request.Images.Select(url => new Attachment
                    {
                        EntityType = EntityType.DailyLog,
                        EntityId = log.LogId,
                        AttachmentType = AttachmentType.DailyLogPhoto,
                        FileName = Path.GetFileName(url) ?? "photo.jpg",
                        FileUrl = url,
                        ContentType = "image/jpeg",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId,
                        IsDeleted = false
                    }).ToList();

                    await _uow.Repository<Attachment>().AddRangeAsync(attachments, cancellationToken);
                }

                // 8. Cập nhật tiến độ của Task hiện tại
                task.ProgressPercent = request.NewProgressPercent;
                
                // Cập nhật trạng thái của Task dựa trên tiến độ
                if (task.ProgressPercent == 100)
                {
                    task.Status = BPG.Domain.Constants.TaskStatus.Completed;
                }
                else if (task.ProgressPercent > 0)
                {
                    task.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                }

                _uow.Repository<ProjectTask>().Update(task);

                // Ghi nhận lịch sử thay đổi tiến độ cho Task hiện tại
                var progressLog = new TaskProgressLog
                {
                    TaskId = task.TaskId,
                    OldProgress = oldProgress,
                    NewProgress = request.NewProgressPercent,
                    UpdateReason = request.Description,
                    UpdatedAt = DateTime.UtcNow
                };
                await _uow.Repository<TaskProgressLog>().AddAsync(progressLog, cancellationToken);

                // 9. Đồng bộ ngược tiến độ của các Task cha (Parent Tasks) nếu có
                if (task.ParentTaskId.HasValue)
                {
                    await _progressRollupService.RecalculateParentTaskProgressAsync(
                        task.ParentTaskId.Value,
                        task.TaskId,
                        cancellationToken);
                }

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                // Fetch Creator Name & Roles để trả về DTO hoàn chỉnh
                var creator = await _uow.Repository<User>().Query()
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.UserId == currentUserId, cancellationToken);

                var dto = _mapper.Map<DailyLogDto>(log);
                dto.TaskName = task.Name;
                dto.CreatorName = creator?.FullName ?? string.Empty;
                dto.Images = request.Images ?? new List<string>();
                dto.OldProgressPercent = oldProgress;

                // Vừa tạo luôn nằm trong cửa sổ chỉnh sửa; lấy config để FE biết giới hạn
                var editWindowConfig = await _uow.Repository<SystemConfig>().Query()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.DailyLogEditWindowHours, cancellationToken);
                int editWindowHours = editWindowConfig != null && int.TryParse(editWindowConfig.ConfigValue, out var parsedHours) && parsedHours > 0
                    ? parsedHours
                    : 24;
                dto.EditWindowHours = editWindowHours;
                dto.CanEdit = true;

                // 10. Gửi thông báo đến những người liên quan
                await SendNotificationsAsync(task, creator?.FullName ?? "Kỹ sư", request.NewProgressPercent, cancellationToken);

                // 11. Gửi realtime cho client dòng thời gian dự án
                await _realtimeSender.SendToGroupAsync($"Project_{project.ProjectId}", "ReceiveDailyLogCreated", dto, cancellationToken);

                return dto;
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }

        private async Task SendNotificationsAsync(ProjectTask task, string creatorName, byte newProgress, CancellationToken cancellationToken)
        {
            var project = task.Phase.Project;
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Lấy danh sách tất cả Project Leaders của dự án (loại trừ người tạo)
            var leaders = await _uow.Repository<ProjectMember>().Query()
                .Where(m => m.ProjectId == project.ProjectId && m.IsLeader && m.UserId != currentUserId)
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var leaderId in leaders)
            {
                await _notificationService.SendNotificationAsync(
                    leaderId,
                    "Cập nhật nhật ký tiến độ",
                    $"Thành viên [{creatorName}] đã cập nhật nhật ký cho công việc [{task.Name}] với tiến độ mới là {newProgress}%.",
                    NotificationType.Progress,
                    NotificationReferenceType.Task,
                    task.TaskId,
                    cancellationToken
                );
            }

            // 2. Lấy danh sách tất cả các thành viên khác được gán cùng vào Task này (loại trừ người tạo)
            var otherAssignees = await _uow.Repository<TaskAssignee>().Query()
                .Where(ta => ta.TaskId == task.TaskId && ta.UserId != currentUserId)
                .Select(ta => ta.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var assigneeId in otherAssignees)
            {
                // Tránh gửi trùng lặp nếu leader cũng đồng thời được gán vào Task này
                if (leaders.Contains(assigneeId)) continue;

                await _notificationService.SendNotificationAsync(
                    assigneeId,
                    "Đồng nghiệp cập nhật tiến độ",
                    $"Thành viên [{creatorName}] cùng thực hiện công việc [{task.Name}] đã cập nhật nhật ký tiến độ mới là {newProgress}%.",
                    NotificationType.Progress,
                    NotificationReferenceType.Task,
                    task.TaskId,
                    cancellationToken
                );
            }

            // 3. Gửi thông báo cho Technical Manager
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "Cập nhật nhật ký tiến độ",
                $"Nhật ký tiến độ mới cho công việc [{task.Name}] tại dự án [{project.Name}] vừa được cập nhật ({newProgress}%).",
                NotificationType.Progress,
                NotificationReferenceType.Task,
                task.TaskId,
                cancellationToken
            );
        }
    }
}
