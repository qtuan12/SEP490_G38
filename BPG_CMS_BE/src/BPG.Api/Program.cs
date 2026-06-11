using System.Text;
using BPG.Application;
using BPG.Domain.Entities;
using BPG.Infrastructure;
using BPG.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
//cấu hình các đường linl của frontend dc phép truy cập backend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "https://localhost:5173",
                "http://localhost:3000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var jwtKey = builder.Configuration["Jwt:Key"];

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],

        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey!)
        )
    };
});

builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await context.Database.MigrateAsync();

    if (!await context.Users.AnyAsync())
    {
        var adminUser = new User
        {
            FullName = "Admin BPG",
            Email = "admin@bpg.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(adminUser);
        await context.SaveChangesAsync();

        var adminRole = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin");
        if (adminRole != null)
        {
            context.UserRoles.Add(new UserRole
            {
                UserId = adminUser.UserId,
                RoleId = adminRole.RoleId,
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }
    }
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();