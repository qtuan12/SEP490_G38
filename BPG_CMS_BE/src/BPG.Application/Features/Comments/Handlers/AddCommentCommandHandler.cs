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

        public AddCommentCommandHandler(
            IUnitOfWork uow, 
            IMapper mapper, 
            ICurrentUserService currentUserService,
            INotificationService notificationService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
        }

        public async Task<CommentDto> Handle(AddCommentCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra DailyLog có tồn tại hay không
            var dailyLog = await _uow.Repository<DailyLog>().Query()
                .Include(d => d.Task)
                    .ThenInclude(t => t.Phase)
                .FirstOrDefaultAsync(d => d.LogId == request.LogId, cancellationToken);

            if (dailyLog == null)
            {
                throw new NotFoundException(nameof(DailyLog), request.LogId);
            }

            // 2. Kiểm tra quyền truy cập (phải là Admin/TM hoặc là thành viên dự án)
            bool isAdminOrTM = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (!isAdminOrTM)
            {
                var isMember = await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(m => m.ProjectId == dailyLog.Task.Phase.ProjectId && m.UserId == currentUserId, cancellationToken);

                if (!isMember)
                {
                    throw new ForbiddenException("Bạn không phải thành viên của dự án này.");
                }
            }

            // 3. Tạo comment
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

            // 5. Gửi thông báo đến người tạo DailyLog (nếu người bình luận không phải người tạo log)
            if (dailyLog.CreatedBy != currentUserId)
            {
                await _notificationService.SendNotificationAsync(
                    dailyLog.CreatedBy,
                    "Bình luận mới dưới nhật ký",
                    $"[{author?.FullName ?? "Ai đó"}] đã bình luận dưới nhật ký thi công của bạn cho công việc [{dailyLog.Task.Name}].",
                    NotificationType.Progress,
                    NotificationReferenceType.Task,
                    dailyLog.TaskId,
                    cancellationToken
                );
            }

            return _mapper.Map<CommentDto>(comment);
        }
    }
}
