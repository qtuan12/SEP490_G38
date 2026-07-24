using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BPG.Infrastructure.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("BPG_CONNECTION_STRING")
            ?? ReadConnectionStringFromApiAppSettings()
            ?? "Server=localhost;Database=BPGDB;Trusted_Connection=True;TrustServerCertificate=True;";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }

    // dotnet ef chạy với working directory tùy theo lệnh gọi (thư mục project hoặc solution) —
    // dò lên các thư mục cha để tìm BPG.Api/appsettings.json và lấy đúng connection string
    // mà từng máy dev đang dùng để chạy ứng dụng, thay vì hardcode riêng cho một máy cụ thể.
    private static string? ReadConnectionStringFromApiAppSettings()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir != null)
        {
            var apiSettingsPath = Path.Combine(dir.FullName, "BPG.Api", "appsettings.json");
            if (File.Exists(apiSettingsPath))
            {
                var json = File.ReadAllText(apiSettingsPath);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("ConnectionStrings", out var cs) &&
                    cs.TryGetProperty("DefaultConnection", out var conn))
                {
                    return conn.GetString();
                }
                return null;
            }
            dir = dir.Parent;
        }
        return null;
    }
}
