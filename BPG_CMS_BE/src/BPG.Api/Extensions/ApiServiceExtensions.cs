using System.Text;
using BPG.Application;
using BPG.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

namespace BPG.Api.Extensions;

public static class ApiServiceExtensions
{
    public const string CorsPolicyName = "AllowReactApp";

    public static WebApplicationBuilder ConfigureApiLogging(this WebApplicationBuilder builder)
    {
        builder.Host.UseSerilog((context, services, configuration) => configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext());

        return builder;
    }

    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        services.AddControllers();
        services.AddConfiguredRateLimiting(configuration);
        services.AddHttpContextAccessor();
        services.AddSignalR();
        services.AddScoped<BPG.Application.IServices.IRealtimeNotificationSender, BPG.Api.Hubs.RealtimeNotificationSender>();

        services.AddApplication();
        services.AddInfrastructure(configuration);

        services.AddConfiguredCors(configuration, environment);
        services.AddJwtAuthentication(configuration);
        services.AddConfiguredAuthorization();
        services.AddConfiguredSwagger();

        return services;
    }

    private static IServiceCollection AddConfiguredCors(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var allowedOrigins = configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? Array.Empty<string>();

        if (!environment.IsDevelopment() && allowedOrigins.Length == 0)
        {
            throw new InvalidOperationException("Production requires Cors:AllowedOrigins to be configured.");
        }

        services.AddCors(options =>
        {
            options.AddPolicy(CorsPolicyName, policy =>
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

        return services;
    }

    private static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            var jwtKey = configuration["Jwt:Key"];
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
                ValidIssuer = configuration["Jwt:Issuer"],
                ValidAudience = configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
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

        return services;
    }

    private static IServiceCollection AddConfiguredAuthorization(this IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });

        return services;
    }

    private static IServiceCollection AddConfiguredSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
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

        return services;
    }
}
