using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Auth.Services;
using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Users.Handlers
{
    public class ToggleUserStatusHandler : IRequestHandler<ToggleUserStatusCommand, UserDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;

        public ToggleUserStatusHandler(IUnitOfWork uow, IMapper mapper, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
        }

        public async Task<UserDto> Handle(ToggleUserStatusCommand request, CancellationToken cancellationToken)
        {
            var user = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == request.Id && !u.IsDeleted, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy tài khoản cần thay đổi trạng thái.");

            // Tài khoản còn IsActive nhưng đang bị khóa tạm do sai mật khẩu quá số lần cho phép
            // cũng hiển thị "locked" ngoài danh sách. Ở trạng thái này ý định của admin là gỡ khóa,
            // không phải khóa hẳn, nên chỉ xóa mốc khóa tạm và dừng tại đây.
            if (user.IsActive && user.LockedUntil.HasValue && user.LockedUntil > DateTime.UtcNow)
            {
                user.LockedUntil = null;
                user.FailedLoginCount = 0;

                _uow.Repository<User>().Update(user);
                await _uow.SaveChangesAsync(cancellationToken);

                return _mapper.Map<UserDto>(user);
            }

            // Khóa tài khoản có cùng hậu quả với xóa (người đó không thao tác được nữa) nên
            // phải qua cùng bộ chốt chặn. Mở khóa thì không cần.
            if (user.IsActive)
            {
                const string action = "khóa";
                UserGuard.EnsureNotSelf(request.Id, _currentUserService.GetRequiredUserId(), action);
                await UserGuard.EnsureNotLastAdminAsync(_uow, request.Id, action, cancellationToken);
                await UserGuard.EnsureNotLeadingActiveProjectAsync(_uow, request.Id, action, cancellationToken);
                await UserGuard.EnsureNotLastApproverWithPendingWorkAsync(_uow, request.Id, action, cancellationToken);
            }

            user.IsActive = !user.IsActive;

            if (user.IsActive)
            {
                user.LockedUntil = null;
                user.FailedLoginCount = 0;
            }
            else
            {
                // Cắt phiên đang đăng nhập, nếu không tài khoản vừa khóa vẫn tự gia hạn token.
                await RefreshTokenRevoker.RevokeAllAsync(_uow, request.Id, cancellationToken);
            }

            _uow.Repository<User>().Update(user);
            await _uow.SaveChangesAsync(cancellationToken);

            return _mapper.Map<UserDto>(user);
        }
    }
}
