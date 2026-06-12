using BPG.Aapplication.IServices;
using BPG.Application.DTOs.Auth;
using BPG.Application.IServices;
using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IJwtService _jwtService;

    public AuthService(AppDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    public async System.Threading.Tasks.Task<LoginResponse?> LoginAsync(string email, string password)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(x => x.Email == email);

        if (user == null || !user.IsActive)
            return null;

        var isPasswordValid = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
        if (!isPasswordValid)
            return null;

        var roleName = user.UserRoles.FirstOrDefault()?.Role?.RoleName ?? "User";

        return new LoginResponse
        {
            UserId = user.UserId,
            FullName = user.FullName,
            Email = user.Email,
            Role = roleName,
            AccessToken = _jwtService.GenerateToken(user)
        };
    }
}
