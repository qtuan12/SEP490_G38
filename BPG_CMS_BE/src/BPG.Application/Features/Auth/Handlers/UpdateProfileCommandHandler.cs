using BPG.Application.DTOs.Auth;
using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers
{
    public class UpdateProfileCommandHandler : IRequestHandler<UpdateProfileCommand, GetCurrentUserDto>
    {
        private readonly IUnitOfWork _uow;

        public UpdateProfileCommandHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<GetCurrentUserDto> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.FullName))
                throw new InvalidOperationException("Họ tên không được để trống.");

            var user = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == request.UserId && !u.IsDeleted, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy người dùng.");

            user.FullName = request.FullName.Trim();
            user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            return new GetCurrentUserDto
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = user.UserRoles.FirstOrDefault()?.Role?.RoleName ?? string.Empty,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                PasswordChangedAt = user.PasswordChangedAt
            };
        }
    }
}
