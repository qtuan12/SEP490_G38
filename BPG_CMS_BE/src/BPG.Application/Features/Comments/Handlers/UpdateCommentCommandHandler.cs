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
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Comments.Handlers
{
    public class UpdateCommentCommandHandler : IRequestHandler<UpdateCommentCommand, CommentDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly ILogger<UpdateCommentCommandHandler>? _logger;

        public UpdateCommentCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender,
            ILogger<UpdateCommentCommandHandler>? logger = null)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _logger = logger;
        }

        public async Task<CommentDto> Handle(UpdateCommentCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra bình luận có tồn tại không
            var comment = await _uow.Repository<Comment>().Query()
                .IgnoreQueryFilters()
                .Include(c => c.Author)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .Include(c => c.DailyLog)
                    .ThenInclude(l => l.Task)
                        .ThenInclude(t => t.Phase)
                            .ThenInclude(p => p.Project)
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId && !c.IsDeleted, cancellationToken);

            if (comment == null)
            {
                throw new NotFoundException("Bình luận", request.CommentId);
            }

            // 2. Kiểm tra quyền sở hữu (chỉ tác giả được sửa)
            if (comment.AuthorId != currentUserId)
            {
                throw new ForbiddenException("Bạn không có quyền chỉnh sửa bình luận này.");
            }

            if (comment.DailyLog.Task.Phase.Project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // 3. Cập nhật thông tin bình luận
            comment.Content = request.Content;
            comment.UpdatedAt = DateTime.UtcNow;
            comment.UpdatedBy = currentUserId;

            _uow.Repository<Comment>().Update(comment);
            await _uow.SaveChangesAsync(cancellationToken);

            var dto = _mapper.Map<CommentDto>(comment);

            // Gửi realtime cho client thuộc dự án
            try
            {
                await _realtimeSender.SendToGroupAsync($"Project_{comment.DailyLog.Task.Phase.ProjectId}", "ReceiveCommentUpdated", dto, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex,
                    "Comment {CommentId} was updated, but post-commit realtime failed for project {ProjectId}.",
                    comment.CommentId,
                    comment.DailyLog.Task.Phase.ProjectId);
            }

            return dto;
        }
    }
}
