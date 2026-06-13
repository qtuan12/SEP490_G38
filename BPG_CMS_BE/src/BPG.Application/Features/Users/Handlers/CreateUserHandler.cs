using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Users.Handlers;

public class CreateUserHandler : IRequestHandler<CreateUserCommand, UserDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public CreateUserHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<UserDto> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        // Kiểm tra email trùng
        var emailExists = await _uow.Repository<User>().AnyAsync(
            u => u.Email.ToLower() == cmd.Email.ToLower(), ct);
        if (emailExists)
            throw new DuplicateEntryException("Email", cmd.Email);

        // Tìm role
        var role = await _uow.Repository<Role>().FirstOrDefaultAsync(
            r => r.RoleName == cmd.Role, ct)
            ?? throw new NotFoundException($"Role '{cmd.Role}' không tồn tại trong hệ thống.");

        // Tạo user
        var user = new User
        {
            FullName = cmd.Name,
            Email = cmd.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("BPG@123456"),
            IsActive = true,
        };
        await _uow.Repository<User>().AddAsync(user, ct);
        await _uow.SaveChangesAsync(ct); // cần ID trước khi thêm UserRole

        // Gán role
        var userRole = new BPG.Domain.Entities.UserRole { UserId = user.UserId, RoleId = role.RoleId };
        await _uow.Repository<BPG.Domain.Entities.UserRole>().AddAsync(userRole, ct);
        await _uow.SaveChangesAsync(ct);

        user.UserRoles = new List<BPG.Domain.Entities.UserRole> { new() { Role = role } };
        return _mapper.Map<UserDto>(user);
    }
}
