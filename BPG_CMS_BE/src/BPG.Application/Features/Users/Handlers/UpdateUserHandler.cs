using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Users.Handlers;

public class UpdateUserHandler : IRequestHandler<UpdateUserCommand, UserDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public UpdateUserHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<UserDto> Handle(UpdateUserCommand cmd, CancellationToken ct)
    {
        var user = await _uow.Repository<User>().Query()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == cmd.Id && !u.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(User), cmd.Id);

        // Cập nhật email nếu có
        if (!string.IsNullOrWhiteSpace(cmd.Email) &&
            !cmd.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var emailTaken = await _uow.Repository<User>().AnyAsync(
                u => u.Email.ToLower() == cmd.Email.ToLower() && u.UserId != cmd.Id, ct);
            if (emailTaken)
                throw new DuplicateEntryException("Email", cmd.Email);
            user.Email = cmd.Email;
        }

        if (!string.IsNullOrWhiteSpace(cmd.Name))
            user.FullName = cmd.Name;

        // Cập nhật role nếu có
        if (!string.IsNullOrWhiteSpace(cmd.Role))
        {
            var role = await _uow.Repository<Role>().FirstOrDefaultAsync(
                r => r.RoleName == cmd.Role, ct)
                ?? throw new NotFoundException($"Role '{cmd.Role}' không tồn tại.");

            // Xóa role cũ, gán role mới
            var existingRoles = await _uow.Repository<UserRole>().FindAsync(
                ur => ur.UserId == cmd.Id, ct);
            _uow.Repository<UserRole>().RemoveRange(existingRoles);
            await _uow.Repository<UserRole>().AddAsync(
                new UserRole { UserId = cmd.Id, RoleId = role.RoleId }, ct);
        }

        _uow.Repository<User>().Update(user);
        await _uow.SaveChangesAsync(ct);

        return _mapper.Map<UserDto>(user);
    }
}
