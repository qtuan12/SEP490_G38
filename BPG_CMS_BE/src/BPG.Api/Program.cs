using System.Text;
using BPG.Api.Middleware;
using BPG.Application;
using BPG.Domain.Entities;
using BPG.Infrastructure;
using BPG.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

// 1. Khởi tạo logger bootstrap tạm thời để log quá trình khởi động
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Ứng dụng BPG-CMS đang khởi động...");

    var builder = WebApplication.CreateBuilder(args);

    // 2. Ép hệ thống dùng Serilog đọc cấu hình từ appsettings
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    builder.Services.AddControllers();
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddSignalR();
    builder.Services.AddScoped<BPG.Application.IServices.IRealtimeNotificationSender, BPG.Api.Hubs.RealtimeNotificationSender>();

    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);

    var allowedOrigins = builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>() ?? Array.Empty<string>();

    if (!builder.Environment.IsDevelopment() && allowedOrigins.Length == 0)
    {
        throw new InvalidOperationException("Production requires Cors:AllowedOrigins to be configured.");
    }

    // Cấu hình CORS của frontend truy cập backend
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowReactApp", policy =>
        {
            policy
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();

            if (allowedOrigins.Length > 0)
            {
                policy.WithOrigins(allowedOrigins);
            }
            else
            {
                policy.SetIsOriginAllowed(_ => true);
            }
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
        if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
        {
            throw new InvalidOperationException("Jwt:Key must be configured and at least 32 bytes long.");
        }

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
            ),

            // Mặc định ASP.NET Core cho phép lệch 5 phút sau khi token hết hạn mới bị từ chối,
            // khiến access token ngắn hạn (15 phút) thực tế sống lâu hơn dự kiến. Bỏ dung sai này
            // để token hết hạn đúng thời điểm cấu hình, ép FE phải refresh đúng lúc.
            ClockSkew = TimeSpan.Zero
        };

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                Console.WriteLine($"[JWT Auth Failed] {context.Exception.Message}");
                return Task.CompletedTask;
            },
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/notifications"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

    builder.Services.AddAuthorization(options =>
    {
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();
    });

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo { Title = "BPG Construction Management API", Version = "v1" });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "Nhập token JWT của bạn (không cần gõ chữ Bearer)",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        });

        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                new List<string>()
            }
        });
    });

    var app = builder.Build();

    // 3. Đăng ký CorrelationIdMiddleware đầu tiên để tracking request-response
    app.UseMiddleware<CorrelationIdMiddleware>();

    // 4. Đăng ký ExceptionMiddleware
    app.UseMiddleware<ExceptionMiddleware>();

    // 5. Đăng ký Serilog Request Logging để ghi log request tự động
    app.UseSerilogRequestLogging(options =>
    {
        options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} phản hồi {StatusCode} sau {Elapsed:0.0000} ms";
    });

    if (args.Contains("--seed"))
    {
        using (var scope = app.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Console.WriteLine("Applying migrations and seeding database...");
            await DbSeeder.SeedAsync(context);
            Console.WriteLine("Seeding completed successfully.");
        }
        
        return;
    }

    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await context.Database.MigrateAsync();
    }

    if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseCors("AllowReactApp");

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "BPG-CMS-API" }))
        .AllowAnonymous();
    app.MapControllers();
    app.MapHub<BPG.Api.Hubs.NotificationHub>("/hubs/notifications");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Ứng dụng bị dừng đột ngột lúc khởi động!");
}
finally
{
    Log.CloseAndFlush();
}
