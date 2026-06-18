using BPG.Application.Features.Comments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Comments.Handlers
{
    public class DeleteCommentCommandHandler : IRequestHandler<DeleteCommentCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;

        public DeleteCommentCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
        }

        public async Task<bool> Handle(DeleteCommentCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra bình luận có tồn tại không
            var comment = await _uow.Repository<Comment>().Query()
                .Include(c => c.DailyLog)
                    .ThenInclude(l => l.Task)
                        .ThenInclude(t => t.Phase)
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId, cancellationToken);

            if (comment == null)
            {
                throw new NotFoundException(nameof(Comment), request.CommentId);
            }

            // 2. Kiểm tra quyền sở hữu (chỉ tác giả được xóa)
            if (comment.AuthorId != currentUserId)
            {
                throw new ForbiddenException("Bạn không có quyền xóa bình luận này.");
            }

            long projectId = comment.DailyLog.Task.Phase.ProjectId;
            long logId = comment.LogId;
            long commentId = comment.CommentId;

            // 3. Thực hiện xóa bình luận (sẽ được SoftDeleteInterceptor tự động chuyển thành Soft Delete)
            _uow.Repository<Comment>().Remove(comment);
            
            var result = await _uow.SaveChangesAsync(cancellationToken);
            bool isSuccess = result > 0;

            if (isSuccess)
            {
                await _realtimeSender.SendToGroupAsync($"Project_{projectId}", "ReceiveCommentDeleted", new { commentId, logId }, cancellationToken);
            }

            return isSuccess;
        }
    }
}
