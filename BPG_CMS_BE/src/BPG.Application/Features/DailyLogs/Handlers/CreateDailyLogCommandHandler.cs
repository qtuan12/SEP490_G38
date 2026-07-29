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

            // 1. Kiá»ƒm tra Task cÃ³ tá»“n táº¡i hay khÃ´ng
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

            var isManager = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (!isManager)
            {
                var isProjectLeader = await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(
                        m => m.ProjectId == project.ProjectId
                            && m.UserId == currentUserId
                            && m.IsLeader,
                        cancellationToken);

                var isAssignee = await _uow.Repository<TaskAssignee>().Query()
                    .AnyAsync(ta => ta.TaskId == task.TaskId && ta.UserId == currentUserId, cancellationToken);

                if (!isProjectLeader && !isAssignee)
                {
                    throw new ForbiddenException("Chá»‰ TrÆ°á»Ÿng dá»± Ã¡n (Leader), Ban quáº£n lÃ½ hoáº·c Ká»¹ sÆ° Ä‘Æ°á»£c gÃ¡n vÃ o cÃ´ng viá»‡c má»›i Ä‘Æ°á»£c phÃ©p táº¡o nháº­t kÃ½ thi cÃ´ng.");
                }
            }

            // 3. Kiá»ƒm tra tráº¡ng thÃ¡i dá»± Ã¡n
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // Kiá»ƒm tra xem cÃ´ng viá»‡c hoáº·c báº¥t ká»³ cÃ´ng viá»‡c cha nÃ o cÃ³ bá»‹ khÃ³a (Ä‘Ã£ nghiá»‡m thu) khÃ´ng
            var tempTask = task;
            while (tempTask != null)
            {
                if (tempTask.IsLocked)
                {
                    throw new BusinessException("ERR_TASK_LOCKED", $"KhÃ´ng thá»ƒ cáº­p nháº­t tiáº¿n Ä‘á»™ vÃ¬ cÃ´ng viá»‡c hoáº·c cáº¥p cha [{tempTask.Name}] Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu vÃ  khÃ³a.");
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


            // 4. Kiá»ƒm tra xem Task cÃ³ pháº£i lÃ  Task cha (cÃ³ subtasks) khÃ´ng
            if (task.SubTasks != null && task.SubTasks.Any(s => !s.IsDeleted))
            {
                throw new BusinessException("ERR_TASK_HAS_SUBTASKS", 
                    "KhÃ´ng thá»ƒ cáº­p nháº­t tiáº¿n Ä‘á»™ thá»§ cÃ´ng cho cÃ´ng viá»‡c cha cÃ³ chá»©a cÃ¡c cÃ´ng viá»‡c con.");
            }

            // 4.5. Kiá»ƒm tra Ä‘iá»u kiá»‡n phá»¥ thuá»™c (Finish-to-Start)
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
                    // TÃ¬m táº¥t cáº£ cÃ¡c ancestor IDs Ä‘á»ƒ loáº¡i trá»« khá»i danh sÃ¡ch cháº·n
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
                            $"KhÃ´ng thá»ƒ cáº­p nháº­t tiáº¿n Ä‘á»™. CÃ¡c cÃ´ng viá»‡c tiÃªn quyáº¿t chÆ°a hoÃ n thÃ nh: {names}");
                    }
                }
            }

            // 5. Kiá»ƒm tra lÃ¹i tiáº¿n Ä‘á»™ (chá»‰ Admin/TM Ä‘Æ°á»£c phÃ©p lÃ¹i tiáº¿n Ä‘á»™)
            byte oldProgress = task.ProgressPercent;
            if (request.NewProgressPercent < oldProgress)
            {
                if (!isManager)
                {
                    throw new BusinessException("ERR_DECREASE_PROGRESS_FORBIDDEN", 
                        "Chá»‰ Quáº£n trá»‹ viÃªn hoáº·c TrÆ°á»Ÿng phÃ²ng ká»¹ thuáº­t má»›i cÃ³ quyá»n giáº£m tiáº¿n Ä‘á»™ cÃ´ng viá»‡c.");
                }

                if (string.IsNullOrWhiteSpace(request.Description))
                {
                    throw new BusinessException("ERR_DECREASE_PROGRESS_REASON_REQUIRED", 
                        "Vui lÃ²ng nháº­p lÃ½ do giáº£m tiáº¿n Ä‘á»™ cÃ´ng viá»‡c.");
                }
            }

            // Báº¯t Ä‘áº§u má»™t transaction Ä‘á»ƒ Ä‘áº£m báº£o lÆ°u dá»¯ liá»‡u nháº¥t quÃ¡n
            await _uow.BeginTransactionAsync(cancellationToken);

            try
            {
                // Giáº£i quyáº¿t tranh cháº¥p Ä‘á»“ng thá»i khi nhiá»u ká»¹ sÆ° bÃ¡o cÃ¡o tiáº¿n Ä‘á»™ cÃ¹ng lÃºc cho cÃ¹ng má»™t dá»± Ã¡n:
                // Sá»­ dá»¥ng sp_getapplock cá»§a SQL Server á»Ÿ cáº¥p Ä‘á»™ dá»± Ã¡n trong suá»‘t thá»i gian cháº¡y transaction
                var lockResource = $"Project_WbsClimb_Lock_{project.ProjectId}";
                await _uow.ExecuteSqlAsync($"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction'", cancellationToken);

                // 6. Táº¡o DailyLog
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
                await _uow.SaveChangesAsync(cancellationToken); // Save Ä‘á»ƒ cÃ³ LogId cho Attachments

                // 7. LÆ°u Attachments (hÃ¬nh áº£nh há»£p lá»‡)
                if (request.Images != null && request.Images.Any())
                {
                    var validUrls = request.Images
                        .Where(url => !string.IsNullOrWhiteSpace(url) && (url.StartsWith("http://") || url.StartsWith("https://")))
                        .ToList();

                    if (validUrls.Any())
                    {
                        var attachments = validUrls.Select(url => new Attachment
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
                }

                // 8. Cáº­p nháº­t tiáº¿n Ä‘á»™ cá»§a Task hiá»‡n táº¡i
                task.ProgressPercent = request.NewProgressPercent;
                
                // Cáº­p nháº­t tráº¡ng thÃ¡i cá»§a Task dá»±a trÃªn tiáº¿n Ä‘á»™
                if (task.ProgressPercent == 100)
                {
                    task.Status = BPG.Domain.Constants.TaskStatus.Completed;
                }
                else if (task.ProgressPercent > 0)
                {
                    task.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                }

                _uow.Repository<ProjectTask>().Update(task);

                // Ghi nháº­n lá»‹ch sá»­ thay Ä‘á»•i tiáº¿n Ä‘á»™ cho Task hiá»‡n táº¡i
                var progressLog = new TaskProgressLog
                {
                    TaskId = task.TaskId,
                    OldProgress = oldProgress,
                    NewProgress = request.NewProgressPercent,
                    UpdateReason = request.Description,
                    UpdatedAt = DateTime.UtcNow
                };
                await _uow.Repository<TaskProgressLog>().AddAsync(progressLog, cancellationToken);

                // 9. Äá»“ng bá»™ ngÆ°á»£c tiáº¿n Ä‘á»™ cá»§a cÃ¡c Task cha (Parent Tasks) náº¿u cÃ³
                if (task.ParentTaskId.HasValue)
                {
                    await _progressRollupService.RecalculateParentTaskProgressAsync(
                        task.ParentTaskId.Value,
                        task.TaskId,
                        cancellationToken);
                }

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                // Fetch Creator Name & Roles Ä‘á»ƒ tráº£ vá» DTO hoÃ n chá»‰nh
                var creator = await _uow.Repository<User>().Query()
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.UserId == currentUserId, cancellationToken);

                var dto = _mapper.Map<DailyLogDto>(log);
                dto.TaskName = task.Name;
                dto.CreatorName = creator?.FullName ?? string.Empty;
                dto.Images = request.Images ?? new List<string>();
                dto.OldProgressPercent = oldProgress;

                // Vá»«a táº¡o luÃ´n náº±m trong cá»­a sá»• chá»‰nh sá»­a; láº¥y config Ä‘á»ƒ FE biáº¿t giá»›i háº¡n
                var editWindowConfig = await _uow.Repository<SystemConfig>().Query()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.DailyLogEditWindowHours, cancellationToken);
                int editWindowHours = editWindowConfig != null && int.TryParse(editWindowConfig.ConfigValue, out var parsedHours) && parsedHours > 0
                    ? parsedHours
                    : 24;
                dto.EditWindowHours = editWindowHours;
                dto.CanEdit = true;

                // 10. Gá»­i thÃ´ng bÃ¡o Ä‘áº¿n nhá»¯ng ngÆ°á»i liÃªn quan
                await SendNotificationsAsync(task, creator?.FullName ?? "Ká»¹ sÆ°", request.NewProgressPercent, cancellationToken);

                // 11. Gá»­i realtime cho client dÃ²ng thá»i gian dá»± Ã¡n
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

            // 1. Láº¥y danh sÃ¡ch táº¥t cáº£ Project Leaders cá»§a dá»± Ã¡n (loáº¡i trá»« ngÆ°á»i táº¡o)
            var leaders = await _uow.Repository<ProjectMember>().Query()
                .Where(m => m.ProjectId == project.ProjectId && m.IsLeader && m.UserId != currentUserId)
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var leaderId in leaders)
            {
                await _notificationService.SendNotificationAsync(
                    leaderId,
                    "Cáº­p nháº­t nháº­t kÃ½ tiáº¿n Ä‘á»™",
                    $"ThÃ nh viÃªn [{creatorName}] Ä‘Ã£ cáº­p nháº­t nháº­t kÃ½ cho cÃ´ng viá»‡c [{task.Name}] vá»›i tiáº¿n Ä‘á»™ má»›i lÃ  {newProgress}%.",
                    NotificationType.Progress,
                    $"/projects/{project.ProjectId}/tasks/{task.TaskId}/logs",
                    task.TaskId,
                    cancellationToken
                );
            }

            // 2. Láº¥y danh sÃ¡ch táº¥t cáº£ cÃ¡c thÃ nh viÃªn khÃ¡c Ä‘Æ°á»£c gÃ¡n cÃ¹ng vÃ o Task nÃ y (loáº¡i trá»« ngÆ°á»i táº¡o)
            var otherAssignees = await _uow.Repository<TaskAssignee>().Query()
                .Where(ta => ta.TaskId == task.TaskId && ta.UserId != currentUserId)
                .Select(ta => ta.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var assigneeId in otherAssignees)
            {
                // TrÃ¡nh gá»­i trÃ¹ng láº·p náº¿u leader cÅ©ng Ä‘á»“ng thá»i Ä‘Æ°á»£c gÃ¡n vÃ o Task nÃ y
                if (leaders.Contains(assigneeId)) continue;

                await _notificationService.SendNotificationAsync(
                    assigneeId,
                    "Äá»“ng nghiá»‡p cáº­p nháº­t tiáº¿n Ä‘á»™",
                    $"ThÃ nh viÃªn [{creatorName}] cÃ¹ng thá»±c hiá»‡n cÃ´ng viá»‡c [{task.Name}] Ä‘Ã£ cáº­p nháº­t nháº­t kÃ½ tiáº¿n Ä‘á»™ má»›i lÃ  {newProgress}%.",
                    NotificationType.Progress,
                    $"/projects/{project.ProjectId}/tasks/{task.TaskId}/logs",
                    task.TaskId,
                    cancellationToken
                );
            }

            // 3. Gá»­i thÃ´ng bÃ¡o cho Technical Manager
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "Cáº­p nháº­t nháº­t kÃ½ tiáº¿n Ä‘á»™",
                $"Nháº­t kÃ½ tiáº¿n Ä‘á»™ má»›i cho cÃ´ng viá»‡c [{task.Name}] táº¡i dá»± Ã¡n [{project.Name}] vá»«a Ä‘Æ°á»£c cáº­p nháº­t ({newProgress}%).",
                NotificationType.Progress,
                $"/projects/{project.ProjectId}/tasks/{task.TaskId}/logs",
                task.TaskId,
                cancellationToken
            );
        }
    }
}


