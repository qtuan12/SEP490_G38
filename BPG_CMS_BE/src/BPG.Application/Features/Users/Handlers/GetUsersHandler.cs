using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Queries;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Users.Handlers
{
    public class GetUsersHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
    {
        private readonly IUserService _userService;

        public GetUsersHandler(IUserService userService)
        {
            _userService = userService;
        }

        public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
        {
            return await _userService.GetUsersAsync();
        }
    }
}
