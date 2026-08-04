using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IRepositories;
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

        public ToggleUserStatusHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<UserDto> Handle(ToggleUserStatusCommand request, CancellationToken cancellationToken)
        {
            var user = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == request.Id && !u.IsDeleted, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy tài khoản cần thay đổi trạng thái.");

            user.IsActive = !user.IsActive;

            if (user.IsActive)
            {
                user.LockedUntil = null;
                user.FailedLoginCount = 0;
            }

            _uow.Repository<User>().Update(user);
            await _uow.SaveChangesAsync(cancellationToken);

            return _mapper.Map<UserDto>(user);
        }
    }
}
