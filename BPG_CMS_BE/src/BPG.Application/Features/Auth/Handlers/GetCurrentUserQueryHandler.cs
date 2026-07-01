using BPG.Application.DTOs.Auth;
using BPG.Application.Features.Auth.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers
{
    public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, GetCurrentUserDto>
    {
        private readonly IUnitOfWork _uow;

        public GetCurrentUserQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<GetCurrentUserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
        {
            var user = await _uow.Repository<User>().Query()
                .AsNoTracking()
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == request.UserId && !u.IsDeleted, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy người dùng.");

            return new GetCurrentUserDto
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                AvatarUrl = user.AvatarUrl,
                Role = user.UserRoles.FirstOrDefault()?.Role?.RoleName ?? string.Empty,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                PasswordChangedAt = user.PasswordChangedAt
            };
        }
    }
}
