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
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DailyLogs.Handlers
{
    public class UpdateDailyLogCommandHandler : IRequestHandler<UpdateDailyLogCommand, DailyLogDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly ILogger<UpdateDailyLogCommandHandler>? _logger;

        public UpdateDailyLogCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender,
            ILogger<UpdateDailyLogCommandHandler>? logger = null)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _logger = logger;
        }

        public async Task<DailyLogDto> Handle(UpdateDailyLogCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra DailyLog có tồn tại hay không
            var log = await _uow.Repository<DailyLog>().Query()
                .Include(d => d.Task)
                    .ThenInclude(t => t.Phase)
                        .ThenInclude(p => p.Project)
                .Include(d => d.Comments)
                    .ThenInclude(c => c.Author)
                .FirstOrDefaultAsync(d => d.LogId == request.LogId, cancellationToken);

            if (log == null)
            {
                throw new NotFoundException(nameof(DailyLog), request.LogId);
            }

            var project = log.Task.Phase.Project;

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
                    .AnyAsync(ta => ta.TaskId == log.TaskId && ta.UserId == currentUserId, cancellationToken);

                var isCreator = log.CreatedBy == currentUserId;

                if (!isProjectLeader && !isAssignee && !isCreator)
                {
                    throw new ForbiddenException("Chỉ người tạo nhật ký, Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép chỉnh sửa nhật ký thi công.");
                }
            }

            // 3. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // Kiểm tra xem công việc có bị khóa (đã nghiệm thu) không
            if (log.Task.IsLocked)
            {
                throw new BusinessException("ERR_TASK_LOCKED", "Công việc này đã được nghiệm thu và khóa tiến độ, không thể chỉnh sửa nhật ký thi công.");
            }

            // Kiểm tra xem công việc hoặc các cấp cha/ancestor có bị khóa (đã nghiệm thu)
            // hoặc bị obsolete (loại bỏ) không — nhất quán với luồng Create.
            var tempTask = log.Task;
            while (tempTask != null)
            {
                if (tempTask.IsLocked)
                {
                    throw new BusinessException("ERR_TASK_LOCKED",
                        $"Không thể chỉnh sửa nhật ký vì công việc hoặc cấp cha [{tempTask.Name}] đã được nghiệm thu và khóa.");
                }

                if (tempTask.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
                {
                    throw new BusinessException("ERR_TASK_OBSOLETE",
                        $"Không thể chỉnh sửa nhật ký vì công việc hoặc cấp cha [{tempTask.Name}] đã bị loại bỏ (obsolete).");
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

            // Giới han thời gian sửa: chỉ cho phép sửa trong khoảng thời gian cấu hình
            // (SystemConfig: DailyLogEditWindowHours, mặc định 24h) kể từ lúc tạo.
            // Quá thời han, nhật ký bị khóa chỉnh sửa để tránh sửa lại nội dung cũ.
            var editWindowConfig = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.DailyLogEditWindowHours, cancellationToken);
            int editWindowHours = editWindowConfig != null && int.TryParse(editWindowConfig.ConfigValue, out var parsedHours) && parsedHours > 0
                ? parsedHours
                : 24;

            var editDeadline = log.CreatedAt.AddHours(editWindowHours);
            if (DateTime.UtcNow > editDeadline)
            {
                throw new BusinessException("ERR_EDIT_WINDOW_EXPIRED",
                    $"Nhật ký thi công chỉ được phép chỉnh sửa trong vòng {editWindowHours} giờ kể từ lúc tạo (cấu hình bởi Quản trị viên). Quá thời han, vui lòng tạo nhật ký mới hoặc liên hệ Quản trị viên.");
            }

            // Bắt đầu một transaction để lưu trữ đồng bộ
            await _uow.BeginTransactionAsync(cancellationToken);

            try
            {
                // 4. Cập nhật mô tả nhật ký thi công + đánh dấu đã chỉnh sửa (audit)
                log.Description = request.Description;
                log.IsEdited = true;
                log.LastEditedAt = DateTime.UtcNow;
                _uow.Repository<DailyLog>().Update(log);

                // 5. Cập nhật Attachments (hình ảnh)
                var existingAttachments = await _uow.Repository<Attachment>().Query()
                    .Where(a => a.EntityType == EntityType.DailyLog && a.EntityId == log.LogId && !a.IsDeleted)
                    .ToListAsync(cancellationToken);

                var existingUrls = existingAttachments.Select(a => a.FileUrl).ToList();
                var newUrls = request.Images ?? new List<string>();

                // Tìm các hình ảnh bị xóa
                var removedAttachments = existingAttachments.Where(a => !newUrls.Contains(a.FileUrl)).ToList();
                foreach (var att in removedAttachments)
                {
                    att.IsDeleted = true;
                    att.UpdatedAt = DateTime.UtcNow;
                    att.UpdatedBy = currentUserId;
                    _uow.Repository<Attachment>().Update(att);
                }

                // Tìm các hình ảnh mới được thêm
                var addedUrls = newUrls.Where(url => !existingUrls.Contains(url)).ToList();
                if (addedUrls.Any())
                {
                    var newAttachments = addedUrls.Select(url => new Attachment
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

                    await _uow.Repository<Attachment>().AddRangeAsync(newAttachments, cancellationToken);
                }

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                // 6. Map kết quả trả về
                var creator = await _uow.Repository<User>().Query()
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.UserId == log.CreatedBy, cancellationToken);

                // Lấy OldProgress của DailyLog này từ TaskProgressLog tương ứng (khớp TaskId và NewProgress gần nhất lúc tạo nhật ký)
                var candidateProgressLogs = await _uow.Repository<TaskProgressLog>().Query()
                    .AsNoTracking()
                    .Where(tpl => tpl.TaskId == log.TaskId && tpl.NewProgress == log.NewProgressPercent && tpl.CreatedBy == log.CreatedBy)
                    .ToListAsync(cancellationToken);

                var progressLog = candidateProgressLogs
                    .OrderBy(tpl => Math.Abs((tpl.CreatedAt - log.CreatedAt).TotalSeconds))
                    .FirstOrDefault();

                var dto = _mapper.Map<DailyLogDto>(log);
                dto.TaskName = log.Task.Name;
                dto.CreatorName = creator?.FullName ?? string.Empty;
                dto.Images = newUrls;
                dto.OldProgressPercent = progressLog?.OldProgress ?? 0;
                dto.EditWindowHours = editWindowHours;
                dto.CanEdit = true; // vừa chỉnh sửa thành công => vẫn trong cửa sổ

                // Gửi realtime cho client dòng thời gian dự án
                try
                {
                    await _realtimeSender.SendToGroupAsync($"Project_{project.ProjectId}", "ReceiveDailyLogUpdated", dto, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex,
                        "Daily log {DailyLogId} was committed, but post-commit realtime failed for project {ProjectId}.",
                        log.LogId,
                        project.ProjectId);
                }

                return dto;
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}

