using BPG.Application.Features.Users.Commands;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Users.Handlers
{
    public class DeleteUserHandler : IRequestHandler<DeleteUserCommand, bool>
    {
        private readonly IUserService _userService;

        public DeleteUserHandler(IUserService userService)
        {
            _userService = userService;
        }

        public async Task<bool> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
        {
            return await _userService.DeleteUserAsync(request.Id);
        }
    }
}
