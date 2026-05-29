using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Users.Handlers
{
    public class ToggleUserStatusHandler : IRequestHandler<ToggleUserStatusCommand, UserDto?>
    {
        private readonly IUserService _userService;

        public ToggleUserStatusHandler(IUserService userService)
        {
            _userService = userService;
        }

        public async Task<UserDto?> Handle(ToggleUserStatusCommand request, CancellationToken cancellationToken)
        {
            return await _userService.ToggleUserStatusAsync(request.Id);
        }
    }
}
