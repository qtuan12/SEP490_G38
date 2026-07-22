using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Users.Handlers;

public class CreateUserHandler : IRequestHandler<CreateUserCommand, UserDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;
    private readonly IEmailService _emailService;

    public CreateUserHandler(IUnitOfWork uow, IMapper mapper, IEmailService emailService)
    {
        _uow = uow;
        _mapper = mapper;
        _emailService = emailService;
    }

    public async Task<UserDto> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        var emailExists = await _uow.Repository<User>().AnyAsync(
            u => u.Email.ToLower() == cmd.Email.ToLower(), ct);
        if (emailExists)
            throw new DuplicateEntryException("Email", cmd.Email);

        var role = await _uow.Repository<Role>().FirstOrDefaultAsync(
            r => r.RoleName.ToLower() == cmd.Role.ToLower(), ct)
            ?? throw new NotFoundException($"Role '{cmd.Role}' không tồn tại trong hệ thống.");

        var password = GeneratePassword();

        var user = new User
        {
            FullName = cmd.Name,
            Email = cmd.Email,
            PhoneNumber = string.IsNullOrWhiteSpace(cmd.PhoneNumber)
                ? null
                : cmd.PhoneNumber.Replace(" ", "").Replace("-", "").Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            IsActive = true,
        };
        await _uow.Repository<User>().AddAsync(user, ct);
        await _uow.SaveChangesAsync(ct);

        var userRole = new UserRole { UserId = user.UserId, RoleId = role.RoleId };
        await _uow.Repository<UserRole>().AddAsync(userRole, ct);
        await _uow.SaveChangesAsync(ct);

        // Gửi email sau khi lưu DB thành công
        await _emailService.SendFromTemplateAsync(
            user.Email,
            "Thông tin tài khoản BPG Construction",
            "WelcomeNewUser",
            new Dictionary<string, string>
            {
                { "FullName", user.FullName },
                { "Email", user.Email },
                { "Password", password }
            },
            ct);

        user.UserRoles = new List<UserRole> { new() { Role = role } };
        return _mapper.Map<UserDto>(user);
    }

    private static string GeneratePassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghjkmnpqrstuvwxyz";
        const string digits = "23456789";
        const string special = "@#$!";

        var rng = Random.Shared;
        // Đảm bảo có ít nhất 1 ký tự mỗi loại
        var chars = new List<char>
        {
            upper[rng.Next(upper.Length)],
            lower[rng.Next(lower.Length)],
            digits[rng.Next(digits.Length)],
            special[rng.Next(special.Length)]
        };

        const string all = upper + lower + digits + special;
        for (int i = 0; i < 4; i++)
            chars.Add(all[rng.Next(all.Length)]);

        // Xáo trộn
        for (int i = chars.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars.ToArray());
    }
}
