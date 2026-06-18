using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Users.Handlers;

public class GetUsersHandler : IRequestHandler<GetUsersQuery, PagedList<UserDto>>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public GetUsersHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<PagedList<UserDto>> Handle(GetUsersQuery request, CancellationToken ct)
    {
        var query = _uow.Repository<User>().Query()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var keyword = request.Search.Trim().ToLower();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(keyword) ||
                u.Email.ToLower().Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var role = request.Role.Trim().ToLower();
            query = query.Where(u =>
                u.UserRoles.Any(ur => ur.Role != null && ur.Role.RoleName.ToLower() == role));
        }

        var paged = await query
            .OrderBy(u => u.FullName)
            .ToPagedListAsync(request, ct);

        var dtos = _mapper.Map<List<UserDto>>(paged.Items);
        return new PagedList<UserDto>(dtos, paged.TotalCount, paged.PageNumber, paged.PageSize);
    }
}
