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
    public class UpdateDailyLogCommandHandler : IRequestHandler<UpdateDailyLogCommand, DailyLogDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;

        public UpdateDailyLogCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
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

            // 2. Kiểm tra quyền sở hữu (chỉ người tạo hoặc Admin/TM mới được sửa nhật ký)
            bool isAdminOrTM = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (log.CreatedBy != currentUserId && !isAdminOrTM)
            {
                throw new ForbiddenException("Bạn không có quyền chỉnh sửa nhật ký thi công này.");
            }

            // 3. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.Active)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // Bắt đầu một transaction để lưu trữ đồng bộ
            await _uow.BeginTransactionAsync(cancellationToken);

            try
            {
                // 4. Cập nhật mô tả nhật ký thi công
                log.Description = request.Description;
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

                // Lấy lại danh sách progress logs của Task này để xác định OldProgressPercent
                var progressLogs = await _uow.Repository<TaskProgressLog>().Query()
                    .AsNoTracking()
                    .Where(tpl => tpl.TaskId == log.TaskId && tpl.NewProgress == log.NewProgressPercent)
                    .ToListAsync(cancellationToken);

                var progressLog = progressLogs
                    .OrderBy(tpl => Math.Abs((tpl.UpdatedAt - log.CreatedAt).TotalSeconds))
                    .FirstOrDefault();

                var dto = _mapper.Map<DailyLogDto>(log);
                dto.TaskName = log.Task.Name;
                dto.CreatorName = creator?.FullName ?? string.Empty;
                dto.Images = newUrls;
                dto.OldProgressPercent = progressLog?.OldProgress ?? 0;

                // Gửi realtime cho client dòng thời gian dự án
                await _realtimeSender.SendToGroupAsync($"Project_{project.ProjectId}", "ReceiveDailyLogUpdated", dto, cancellationToken);

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
