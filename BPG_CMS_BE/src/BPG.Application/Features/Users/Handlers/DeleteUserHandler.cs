using BPG.Application.Features.Auth.Services;
using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Users.Handlers;

public class DeleteUserHandler : IRequestHandler<DeleteUserCommand, string>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUserService;

    public DeleteUserHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
    {
        _uow = uow;
        _currentUserService = currentUserService;
    }

    public async Task<string> Handle(DeleteUserCommand request, CancellationToken ct)
    {
        var currentUserId = _currentUserService.GetRequiredUserId();

        var user = await _uow.Repository<User>().GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy tài khoản cần xóa.");

        const string action = "xóa";
        UserGuard.EnsureNotSelf(request.Id, currentUserId, action);
        await UserGuard.EnsureNotLastAdminAsync(_uow, request.Id, action, ct);
        await UserGuard.EnsureNotLeadingActiveProjectAsync(_uow, request.Id, action, ct);
        await UserGuard.EnsureNotLastApproverWithPendingWorkAsync(_uow, request.Id, action, ct);

        // Soft delete qua IsDeleted (SoftDeleteInterceptor tự xử lý khi SaveChanges)
        user.IsDeleted = true;
        _uow.Repository<User>().Update(user);

        // Cắt phiên đang đăng nhập: nếu để lại refresh token, tài khoản vừa xóa vẫn tự gia hạn
        // và dùng tiếp như chưa có chuyện gì.
        await RefreshTokenRevoker.RevokeAllAsync(_uow, request.Id, ct);

        await _uow.SaveChangesAsync(ct);
        return user.FullName;
    }
}
