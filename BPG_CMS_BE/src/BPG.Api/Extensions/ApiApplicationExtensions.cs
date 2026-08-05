using BPG.Api.Hubs;
using BPG.Api.Middleware;
using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace BPG.Api.Extensions;

public static class ApiApplicationExtensions
{
    public static async Task<bool> TryRunSeedAsync(this WebApplication app, string[] args)
    {
        if (!args.Contains("--seed"))
        {
            return false;
        }

        using var scope = app.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Console.WriteLine("Applying migrations and seeding database...");
        await DbSeeder.SeedAsync(context);
        Console.WriteLine("Seeding completed successfully.");

        return true;
    }

    public static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await context.Database.MigrateAsync();
        await DbSeeder.SeedAsync(context);
    }

    public static WebApplication UseApiPipeline(this WebApplication app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<ExceptionMiddleware>();

        app.UseSerilogRequestLogging(options =>
        {
            options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} phản hồi {StatusCode} sau {Elapsed:0.0000} ms";
        });

        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseCors(ApiServiceExtensions.CorsPolicyName);
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "BPG-CMS-API" }))
            .AllowAnonymous();
        app.MapControllers();
        app.MapHub<NotificationHub>("/hubs/notifications");

        return app;
    }
}
