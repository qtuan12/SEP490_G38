using BPG.Application.DTOs.Users;
using MediatR;

namespace BPG.Application.Features.Users.Queries
{
    public record GetUsersQuery() : IRequest<List<UserDto>>;
}
