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
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Comments.Handlers
{
    public class UpdateCommentCommandHandler : IRequestHandler<UpdateCommentCommand, CommentDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;

        public UpdateCommentCommandHandler(IUnitOfWork uow, IMapper mapper, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
        }

        public async Task<CommentDto> Handle(UpdateCommentCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Kiểm tra bình luận có tồn tại không
            var comment = await _uow.Repository<Comment>().Query()
                .Include(c => c.Author)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId, cancellationToken);

            if (comment == null)
            {
                throw new NotFoundException(nameof(Comment), request.CommentId);
            }

            // 2. Kiểm tra quyền sở hữu (chỉ tác giả hoặc TM/Admin được sửa)
            bool isAdminOrTM = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (comment.AuthorId != currentUserId && !isAdminOrTM)
            {
                throw new ForbiddenException("Bạn không có quyền chỉnh sửa bình luận này.");
            }

            // 3. Cập nhật thông tin bình luận
            comment.Content = request.Content;
            comment.UpdatedAt = DateTime.UtcNow;
            comment.UpdatedBy = currentUserId;

            _uow.Repository<Comment>().Update(comment);
            await _uow.SaveChangesAsync(cancellationToken);

            return _mapper.Map<CommentDto>(comment);
        }
    }
}
