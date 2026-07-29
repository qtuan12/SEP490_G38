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

            // 1. Kiá»ƒm tra DailyLog cÃ³ tá»“n táº¡i hay khÃ´ng
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

                if (!isProjectLeader && !isAssignee)
                {
                    throw new ForbiddenException("Chá»‰ TrÆ°á»Ÿng dá»± Ã¡n (Leader), Ban quáº£n lÃ½ hoáº·c Ká»¹ sÆ° Ä‘Æ°á»£c gÃ¡n vÃ o cÃ´ng viá»‡c má»›i Ä‘Æ°á»£c phÃ©p chá»‰nh sá»­a nháº­t kÃ½ thi cÃ´ng.");
                }
            }

            // 3. Kiá»ƒm tra tráº¡ng thÃ¡i dá»± Ã¡n
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // Kiá»ƒm tra xem cÃ´ng viá»‡c cÃ³ bá»‹ khÃ³a (Ä‘Ã£ nghiá»‡m thu) khÃ´ng
            if (log.Task.IsLocked)
            {
                throw new BusinessException("ERR_TASK_LOCKED", "CÃ´ng viá»‡c nÃ y Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu vÃ  khÃ³a tiáº¿n Ä‘á»™, khÃ´ng thá»ƒ chá»‰nh sá»­a nháº­t kÃ½ thi cÃ´ng.");
            }

            // Kiá»ƒm tra xem cÃ´ng viá»‡c hoáº·c cÃ¡c cáº¥p cha/ancestor cÃ³ bá»‹ khÃ³a (Ä‘Ã£ nghiá»‡m thu)
            // hoáº·c bá»‹ obsolete (loáº¡i bá») khÃ´ng â€” nháº¥t quÃ¡n vá»›i luá»“ng Create.
            var tempTask = log.Task;
            while (tempTask != null)
            {
                if (tempTask.IsLocked)
                {
                    throw new BusinessException("ERR_TASK_LOCKED",
                        $"KhÃ´ng thá»ƒ chá»‰nh sá»­a nháº­t kÃ½ vÃ¬ cÃ´ng viá»‡c hoáº·c cáº¥p cha [{tempTask.Name}] Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu vÃ  khÃ³a.");
                }

                if (tempTask.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
                {
                    throw new BusinessException("ERR_TASK_OBSOLETE",
                        $"KhÃ´ng thá»ƒ chá»‰nh sá»­a nháº­t kÃ½ vÃ¬ cÃ´ng viá»‡c hoáº·c cáº¥p cha [{tempTask.Name}] Ä‘Ã£ bá»‹ loáº¡i bá» (obsolete).");
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

            // Giá»›i han thá»i gian sá»­a: chá»‰ cho phÃ©p sá»­a trong khoáº£ng thá»i gian cáº¥u hÃ¬nh
            // (SystemConfig: DailyLogEditWindowHours, máº·c Ä‘á»‹nh 24h) ká»ƒ tá»« lÃºc táº¡o.
            // QuÃ¡ thá»i han, nháº­t kÃ½ bá»‹ khÃ³a chá»‰nh sá»­a Ä‘á»ƒ trÃ¡nh sá»­a láº¡i ná»™i dung cÅ©.
            var editWindowConfig = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.DailyLogEditWindowHours, cancellationToken);
            int editWindowHours = editWindowConfig != null && int.TryParse(editWindowConfig.ConfigValue, out var parsedHours) && parsedHours > 0
                ? parsedHours
                : 24;

            var editDeadline = log.CreatedAt.AddHours(editWindowHours);
            if (DateTime.UtcNow > editDeadline)
            {
                throw new BusinessException("ERR_EDIT_WINDOW_EXPIRED",
                    $"Nháº­t kÃ½ thi cÃ´ng chá»‰ Ä‘Æ°á»£c phÃ©p chá»‰nh sá»­a trong vÃ²ng {editWindowHours} giá» ká»ƒ tá»« lÃºc táº¡o (cáº¥u hÃ¬nh bá»Ÿi Quáº£n trá»‹ viÃªn). QuÃ¡ thá»i han, vui lÃ²ng táº¡o nháº­t kÃ½ má»›i hoáº·c liÃªn há»‡ Quáº£n trá»‹ viÃªn.");
            }

            // Báº¯t Ä‘áº§u má»™t transaction Ä‘á»ƒ lÆ°u trá»¯ Ä‘á»“ng bá»™
            await _uow.BeginTransactionAsync(cancellationToken);

            try
            {
                // 4. Cáº­p nháº­t mÃ´ táº£ nháº­t kÃ½ thi cÃ´ng + Ä‘Ã¡nh dáº¥u Ä‘Ã£ chá»‰nh sá»­a (audit)
                log.Description = request.Description;
                log.IsEdited = true;
                log.LastEditedAt = DateTime.UtcNow;
                _uow.Repository<DailyLog>().Update(log);

                // 5. Cáº­p nháº­t Attachments (hÃ¬nh áº£nh)
                var existingAttachments = await _uow.Repository<Attachment>().Query()
                    .Where(a => a.EntityType == EntityType.DailyLog && a.EntityId == log.LogId && !a.IsDeleted)
                    .ToListAsync(cancellationToken);

                var existingUrls = existingAttachments.Select(a => a.FileUrl).ToList();
                var newUrls = request.Images ?? new List<string>();

                // TÃ¬m cÃ¡c hÃ¬nh áº£nh bá»‹ xÃ³a
                var removedAttachments = existingAttachments.Where(a => !newUrls.Contains(a.FileUrl)).ToList();
                foreach (var att in removedAttachments)
                {
                    att.IsDeleted = true;
                    att.UpdatedAt = DateTime.UtcNow;
                    att.UpdatedBy = currentUserId;
                    _uow.Repository<Attachment>().Update(att);
                }

                // TÃ¬m cÃ¡c hÃ¬nh áº£nh má»›i Ä‘Æ°á»£c thÃªm
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

                // 6. Map káº¿t quáº£ tráº£ vá»
                var creator = await _uow.Repository<User>().Query()
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.UserId == log.CreatedBy, cancellationToken);

                // Láº¥y láº¡i danh sÃ¡ch progress logs cá»§a Task nÃ y Ä‘á»ƒ xÃ¡c Ä‘á»‹nh OldProgressPercent
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
                dto.EditWindowHours = editWindowHours;
                dto.CanEdit = true; // vá»«a chá»‰nh sá»­a thÃ nh cÃ´ng => váº«n trong cá»­a sá»•

                // Gá»­i realtime cho client dÃ²ng thá»i gian dá»± Ã¡n
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

