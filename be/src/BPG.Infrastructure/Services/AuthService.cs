using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
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

        public async Task<LoginResponse?> LoginAsync(string email, string password)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.Email == email);

            if (user == null)
                return null;

            if (!user.IsActive)
                return null;

            var isPasswordValid = BCrypt.Net.BCrypt.Verify(
                password,
                user.PasswordHash
            );

            if (!isPasswordValid)
                return null;

            return new LoginResponse
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                AccessToken = _jwtService.GenerateToken(user)
            };
        }
    }
