using BPG.Application.Features.Auth.Commands;
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

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordChangedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(cancellationToken);
        }
    }
}
