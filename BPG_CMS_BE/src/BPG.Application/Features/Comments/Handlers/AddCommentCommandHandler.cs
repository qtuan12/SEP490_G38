using AutoMapper;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.Comments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Comments.Handlers
{
    public class AddCommentCommandHandler : IRequestHandler<AddCommentCommand, CommentDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly ILogger<AddCommentCommandHandler>? _logger;

        public AddCommentCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            INotificationService notificationService,
            IRealtimeNotificationSender realtimeSender,
            ILogger<AddCommentCommandHandler>? logger = null)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
            _realtimeSender = realtimeSender;
            _logger = logger;
        }

        public async Task<CommentDto> Handle(AddCommentCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra DailyLog có tồn tại hay không
            var dailyLog = await _uow.Repository<DailyLog>().Query()
                .Include(d => d.Task)
                    .ThenInclude(t => t.Phase)
                        .ThenInclude(p => p.Project)
                .FirstOrDefaultAsync(d => d.LogId == request.LogId, cancellationToken);

            if (dailyLog == null)
            {
                throw new NotFoundException(nameof(DailyLog), request.LogId);
            }

            if (dailyLog.Task.Phase.Project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // 2. Tạo comment
            var comment = new Comment
            {
                LogId = request.LogId,
                AuthorId = currentUserId,
                Content = request.Content,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId,
                IsDeleted = false
            };

            await _uow.Repository<Comment>().AddAsync(comment, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            // 4. Lấy thông tin tác giả để mapping đầy đủ
            var author = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == currentUserId, cancellationToken);

            comment.Author = author!;

            var committedDto = _mapper.Map<CommentDto>(comment);

            // 5. Gửi thông báo đến người tạo DailyLog (nếu người bình luận không phải người tạo log)
            try
            {
            if (dailyLog.CreatedBy != currentUserId)
            {
                await _notificationService.SendNotificationAsync(
                    dailyLog.CreatedBy,
                    "Bình luận mới dưới nhật ký",
                    $"{author?.FullName ?? "Ai đó"} đã bình luận dưới nhật ký thi công của bạn cho công việc {dailyLog.Task.Name}.",
                    NotificationType.Progress,
                    $"/projects/{dailyLog.Task.Phase.ProjectId}/tasks/{dailyLog.TaskId}/logs?logId={dailyLog.LogId}",
                    dailyLog.LogId,
                    cancellationToken
                );
            }

            // 6. Gửi thông báo đến các thành viên khác từng bình luận ở bài viết này
            var otherCommenterIds = await _uow.Repository<Comment>().Query()
                .Where(c => c.LogId == request.LogId && c.AuthorId != currentUserId && c.AuthorId != dailyLog.CreatedBy && !c.IsDeleted)
                .Select(c => c.AuthorId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var commenterId in otherCommenterIds)
            {
                await _notificationService.SendNotificationAsync(
                    commenterId,
                    "Hoạt động bình luận mới",
                    $"{author?.FullName ?? "Ai đó"} cũng đã bình luận về nhật ký thi công cho công việc {dailyLog.Task.Name} mà bạn quan tâm.",
                    NotificationType.Progress,
                    $"/projects/{dailyLog.Task.Phase.ProjectId}/tasks/{dailyLog.TaskId}/logs?logId={dailyLog.LogId}",
                    dailyLog.LogId,
                    cancellationToken
                );
            }

            var dto = _mapper.Map<CommentDto>(comment);

            // Gửi realtime cho client thuộc dự án
            await _realtimeSender.SendToGroupAsync($"Project_{dailyLog.Task.Phase.ProjectId}", "ReceiveCommentAdded", dto, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex,
                    "Comment {CommentId} was committed, but post-commit notification/realtime failed for project {ProjectId}.",
                    comment.CommentId,
                    dailyLog.Task.Phase.ProjectId);
            }

            return committedDto;
        }
    }
}
