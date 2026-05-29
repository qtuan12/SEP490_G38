using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Users.Handlers
{
    public class UpdateUserHandler : IRequestHandler<UpdateUserCommand, UserDto?>
    {
        private readonly IUserService _userService;

        public UpdateUserHandler(IUserService userService)
        {
            _userService = userService;
        }

        public async Task<UserDto?> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
        {
            return await _userService.UpdateUserAsync(request.Id, request.Name, request.Email, request.Role);
        }
    }
}
