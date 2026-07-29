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
            var user = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == request.UserId && !u.IsDeleted, cancellationToken)
                ?? throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng.");

            user.FullName = request.FullName.Trim();
            user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber)
                ? null
                : request.PhoneNumber.Replace(" ", "").Replace("-", "").Trim();
            if (!string.IsNullOrWhiteSpace(request.AvatarUrl))
                user.AvatarUrl = request.AvatarUrl.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            var roles = user.UserRoles
                .Where(userRole => userRole.Role != null)
                .Select(userRole => userRole.Role!.RoleName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(role => role, StringComparer.Ordinal)
                .ToList();

            return new GetCurrentUserDto
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                AvatarUrl = user.AvatarUrl,
                Role = roles.FirstOrDefault() ?? string.Empty,
                Roles = roles,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                PasswordChangedAt = user.PasswordChangedAt
            };
        }
    }
}



