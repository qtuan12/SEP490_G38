using BPG.Application.Features.Auth.Commands;
using BPG.Application.Features.Auth.Services;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers
{
    public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand>
    {
        private readonly IUnitOfWork _uow;

        public ChangePasswordCommandHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
        {
            var user = await _uow.Repository<User>().Query()
                .FirstOrDefaultAsync(u => u.UserId == request.UserId && !u.IsDeleted, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy người dùng.");

            // Phải là DomainException: InvalidOperationException rơi vào nhánh mặc định của
            // ExceptionMiddleware và bị trả về thành lỗi 500 "lỗi hệ thống" cho một lỗi nhập liệu.
            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
                throw new BusinessException(ErrorCodes.CurrentPasswordIncorrect, "Mật khẩu hiện tại không chính xác.");

            // Cùng luật với luồng quên mật khẩu (ResetPasswordCommandHandler): đổi sang đúng mật
            // khẩu đang dùng thì không phải là đổi, mà còn khiến người dùng tưởng đã bảo mật lại.
            if (BCrypt.Net.BCrypt.Verify(request.NewPassword, user.PasswordHash))
                throw new BusinessException(ErrorCodes.SamePassword, "Mật khẩu mới phải khác mật khẩu hiện tại.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordChangedAt = DateTime.UtcNow;

            // Đổi mật khẩu phải cắt mọi phiên cũ: người đổi vì nghi bị lộ tài khoản mà kẻ kia
            // vẫn giữ refresh token thì đổi mật khẩu chẳng có tác dụng gì. Đăng nhập lại sau đó.
            await RefreshTokenRevoker.RevokeAllAsync(_uow, user.UserId, cancellationToken);

            await _uow.SaveChangesAsync(cancellationToken);
        }
    }
}
