using BPG.Application.Features.Comments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Comments.Handlers
{
    public class DeleteCommentCommandHandler : IRequestHandler<DeleteCommentCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly ILogger<DeleteCommentCommandHandler>? _logger;

        public DeleteCommentCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender,
            ILogger<DeleteCommentCommandHandler>? logger = null)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _logger = logger;
        }

        public async Task<bool> Handle(DeleteCommentCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra bình luận có tồn tại không
            var comment = await _uow.Repository<Comment>().Query()
                .IgnoreQueryFilters()
                .Include(c => c.DailyLog)
                    .ThenInclude(l => l.Task)
                        .ThenInclude(t => t.Phase)
                            .ThenInclude(p => p.Project)
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId && !c.IsDeleted, cancellationToken);

            if (comment == null)
            {
                throw new NotFoundException("Bình luận", request.CommentId);
            }

            // 2. Kiểm tra quyền sở hữu (chỉ tác giả hoặc Ban quản lý/Admin được xóa)
            var isManager = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (!isManager && comment.AuthorId != currentUserId)
            {
                throw new ForbiddenException("Bạn không có quyền xóa bình luận này.");
            }

            if (comment.DailyLog.Task.Phase.Project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            long projectId = comment.DailyLog?.Task?.Phase?.ProjectId ?? 0;
            long logId = comment.LogId;
            long commentId = comment.CommentId;

            // 3. Thực hiện xóa bình luận (Soft Delete)
            _uow.Repository<Comment>().Remove(comment);
            
            var result = await _uow.SaveChangesAsync(cancellationToken);
            bool isSuccess = result > 0;

            if (isSuccess && projectId > 0)
            {
                try
                {
                    await _realtimeSender.SendToGroupAsync($"Project_{projectId}", "ReceiveCommentDeleted", new { commentId, logId }, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex,
                        "Comment {CommentId} was deleted, but post-commit realtime failed for project {ProjectId}.",
                        commentId,
                        projectId);
                }
            }

            return isSuccess;
        }
    }
}
