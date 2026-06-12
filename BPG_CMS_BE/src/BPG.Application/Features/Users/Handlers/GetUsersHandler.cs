using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Users.Handlers;

public class GetUsersHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
{
    private readonly IUnitOfWork _uow;

    public GetUsersHandler(IUnitOfWork uow) => _uow = uow;

    public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken ct)
    {
        var users = await _uow.Repository<User>().Query()
            .Where(u => !u.IsDeleted)
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .OrderBy(u => u.FullName)
            .ToListAsync(ct);

        return users.Select(UserDto.FromEntity).ToList();
    }
}
