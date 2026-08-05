using BPG.Api.Extensions;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Ứng dụng BPG-CMS đang khởi động...");

    var builder = WebApplication.CreateBuilder(args);

    builder.ConfigureApiLogging();
    builder.Services.AddApiServices(builder.Configuration, builder.Environment);

    var app = builder.Build();

    if (await app.TryRunSeedAsync(args))
    {
        return;
    }

    await app.MigrateDatabaseAsync();

    if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseHttpsRedirection();

    app.UseCors("AllowReactApp");

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "BPG-CMS-API" }))
        .AllowAnonymous();
    app.MapControllers();
    app.MapHub<BPG.Api.Hubs.NotificationHub>("/hubs/notifications");

    app.UseApiPipeline();
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
