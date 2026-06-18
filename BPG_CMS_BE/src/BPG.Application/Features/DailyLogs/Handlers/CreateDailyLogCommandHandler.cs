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

        public CreateDailyLogCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            INotificationService notificationService,
            IRealtimeNotificationSender realtimeSender)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
            _realtimeSender = realtimeSender;
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

            // 2. Kiểm tra quyền của User
            bool isAdminOrTM = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (!isAdminOrTM)
            {
                // Kiểm tra xem User có phải là thành viên trong dự án này không
                var isMember = await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(m => m.ProjectId == project.ProjectId && m.UserId == currentUserId, cancellationToken);

                if (!isMember)
                {
                    throw new ForbiddenException("Bạn không phải thành viên của dự án này.");
                }
            }

            // 3. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // 4. Kiểm tra xem Task có phải là Task cha (có subtasks) không
            if (task.SubTasks != null && task.SubTasks.Any(s => !s.IsDeleted))
            {
                throw new BusinessException("ERR_TASK_HAS_SUBTASKS", 
                    "Không thể cập nhật tiến độ thủ công cho công việc cha có chứa các công việc con.");
            }

            // 5. Kiểm tra lùi tiến độ (chỉ Admin/TM được phép lùi tiến độ)
            byte oldProgress = task.ProgressPercent;
            if (request.NewProgressPercent < oldProgress)
            {
                if (!isAdminOrTM)
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
                await SyncParentTasksProgressAsync(task, currentUserId, cancellationToken);

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

        private async Task SyncParentTasksProgressAsync(ProjectTask currentTask, long userId, CancellationToken cancellationToken)
        {
            var parentId = currentTask.ParentTaskId;
            var current = currentTask;

            while (parentId.HasValue)
            {
                var parent = await _uow.Repository<ProjectTask>().Query()
                    .Include(t => t.SubTasks)
                    .FirstOrDefaultAsync(t => t.TaskId == parentId.Value, cancellationToken);

                if (parent == null) break;

                // Lấy tất cả task con của parent này (không bao gồm các task đã bị xóa)
                var siblingTasks = parent.SubTasks.Where(s => !s.IsDeleted).ToList();
                if (!siblingTasks.Any()) break;

                // Tính trung bình cộng tiến độ
                byte oldParentProgress = parent.ProgressPercent;
                double avgProgress = siblingTasks.Average(s => s.ProgressPercent);
                byte newParentProgress = (byte)Math.Round(avgProgress);

                if (oldParentProgress != newParentProgress)
                {
                    parent.ProgressPercent = newParentProgress;

                    // Cập nhật trạng thái cho Task cha
                    if (parent.ProgressPercent == 100)
                    {
                        parent.Status = BPG.Domain.Constants.TaskStatus.Completed;
                    }
                    else if (parent.ProgressPercent > 0)
                    {
                        parent.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                    }

                    _uow.Repository<ProjectTask>().Update(parent);

                    // Ghi nhận lịch sử cho Task cha
                    var parentProgressLog = new TaskProgressLog
                    {
                        TaskId = parent.TaskId,
                        OldProgress = oldParentProgress,
                        NewProgress = newParentProgress,
                        UpdateReason = "Cập nhật tự động từ tiến độ các công việc con",
                        UpdatedAt = DateTime.UtcNow
                    };
                    await _uow.Repository<TaskProgressLog>().AddAsync(parentProgressLog, cancellationToken);
                }

                current = parent;
                parentId = current.ParentTaskId;
            }
        }

        private async Task SendNotificationsAsync(ProjectTask task, string creatorName, byte newProgress, CancellationToken cancellationToken)
        {
            var project = task.Phase.Project;
            var currentUserId = _currentUserService.GetRequiredUserId();

            // Lấy Project Leader của dự án
            var leader = await _uow.Repository<ProjectMember>().Query()
                .FirstOrDefaultAsync(m => m.ProjectId == project.ProjectId && m.IsLeader, cancellationToken);

            // Gửi thông báo đến Project Leader
            if (leader != null && leader.UserId != currentUserId)
            {
                await _notificationService.SendNotificationAsync(
                    leader.UserId,
                    "Cập nhật nhật ký tiến độ",
                    $"Kỹ sư [{creatorName}] đã cập nhật nhật ký cho công việc [{task.Name}] với tiến độ mới là {newProgress}%.",
                    NotificationType.Progress,
                    NotificationReferenceType.Task,
                    task.TaskId,
                    cancellationToken
                );
            }

            // Gửi thông báo cho Technical Manager
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
