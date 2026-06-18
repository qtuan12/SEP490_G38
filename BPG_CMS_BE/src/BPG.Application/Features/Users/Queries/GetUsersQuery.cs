using BPG.Application.Common.Models;
using BPG.Application.DTOs.Users;
using MediatR;

namespace BPG.Application.Features.Users.Queries;

public class GetUsersQuery : PaginationRequest, IRequest<PagedList<UserDto>>
{
    public string? Role { get; set; }
}
