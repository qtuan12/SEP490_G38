using System.Security.Cryptography;
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
        // Tài khoản và vai trò phải vào cùng một transaction: lỗi ở bước gán vai trò mà bước tạo
        // đã commit sẽ để lại tài khoản không có vai trò nào — đăng nhập được nhưng mọi endpoint
        // đều trả 403, và Admin không nhìn ra vì danh sách vẫn hiện tài khoản đó.
        await _uow.BeginTransactionAsync(ct);
        try
        {
            await _uow.Repository<User>().AddAsync(user, ct);
            await _uow.SaveChangesAsync(ct);

            var userRole = new UserRole { UserId = user.UserId, RoleId = role.RoleId };
            await _uow.Repository<UserRole>().AddAsync(userRole, ct);
            await _uow.SaveChangesAsync(ct);

            await _uow.CommitTransactionAsync(ct);
        }
        catch
        {
            await _uow.RollbackTransactionAsync(ct);
            throw;
        }

        // Gửi email sau khi commit: gửi trong transaction thì email đã bay đi rồi mà DB vẫn có
        // thể rollback, người nhận cầm mật khẩu của một tài khoản không tồn tại.
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

    /// <summary>
    /// Sinh mật khẩu khởi tạo gửi qua email cho tài khoản mới.
    ///
    /// Dùng nguồn ngẫu nhiên mật mã, không dùng Random: Random là PRNG tất định, ai tạo được
    /// vài tài khoản là suy ra được trạng thái bộ sinh rồi đoán mật khẩu của tài khoản khác
    /// tạo cùng thời điểm.
    /// </summary>
    private static string GeneratePassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghjkmnpqrstuvwxyz";
        const string digits = "23456789";
        const string special = "@#$!";

        // Đảm bảo có ít nhất 1 ký tự mỗi loại
        var chars = new List<char>
        {
            Pick(upper),
            Pick(lower),
            Pick(digits),
            Pick(special)
        };

        const string all = upper + lower + digits + special;
        for (int i = 0; i < 8; i++)
            chars.Add(Pick(all));

        // Xáo trộn Fisher-Yates, cũng bằng nguồn ngẫu nhiên mật mã
        for (int i = chars.Count - 1; i > 0; i--)
        {
            int j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars.ToArray());
    }

    private static char Pick(string source) => source[RandomNumberGenerator.GetInt32(source.Length)];
}
