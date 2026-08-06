using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BPG.Infrastructure.Data;

/// <summary>
/// Chỉ dùng cho công cụ dòng lệnh EF (dotnet ef migrations / database update).
/// Chuỗi kết nối phải lấy đúng từ appsettings của BPG.Api — nếu hardcode ở đây thì lệnh ef sẽ
/// âm thầm chạy vào một database khác với database mà ứng dụng dùng.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlServer(ResolveConnectionString());
        return new AppDbContext(optionsBuilder.Options);
    }

    private static string ResolveConnectionString()
    {
        // Biến môi trường thắng file cấu hình — cùng thứ tự ưu tiên với ASP.NET Core,
        // để trỏ sang DB khác mà không phải sửa file.
        var fromEnv = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrWhiteSpace(fromEnv)) return fromEnv;

        var apiDir = FindApiProjectDirectory()
            ?? throw new InvalidOperationException(
                "Không tìm thấy thư mục BPG.Api chứa appsettings.json để đọc chuỗi kết nối. " +
                "Hãy chạy lệnh ef từ trong repo, hoặc đặt biến môi trường ConnectionStrings__DefaultConnection.");

        // appsettings.{Environment}.json ghi đè appsettings.json, giống pipeline cấu hình của app.
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var connectionString =
            ReadDefaultConnection(Path.Combine(apiDir, $"appsettings.{environment}.json"))
            ?? ReadDefaultConnection(Path.Combine(apiDir, "appsettings.json"));

        return connectionString
            ?? throw new InvalidOperationException(
                $"Không đọc được ConnectionStrings:DefaultConnection trong appsettings của '{apiDir}'.");
    }

    private static string? ReadDefaultConnection(string appsettingsPath)
    {
        if (!File.Exists(appsettingsPath)) return null;

        using var doc = JsonDocument.Parse(File.ReadAllText(appsettingsPath));
        if (!doc.RootElement.TryGetProperty("ConnectionStrings", out var section)) return null;
        if (!section.TryGetProperty("DefaultConnection", out var value)) return null;

        var connectionString = value.GetString();
        return string.IsNullOrWhiteSpace(connectionString) ? null : connectionString;
    }

    /// <summary>
    /// Thư mục làm việc của lệnh ef thay đổi tùy cách gọi (--project, --startup-project, chạy từ
    /// gốc repo hay từ trong project), nên dò ngược lên trên qua các vị trí có thể có của BPG.Api.
    /// </summary>
    private static string? FindApiProjectDirectory()
    {
        string[] candidates =
        [
            ".",
            "BPG.Api",
            Path.Combine("src", "BPG.Api"),
            Path.Combine("BPG_CMS_BE", "src", "BPG.Api"),
        ];

        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir != null)
        {
            foreach (var candidate in candidates)
            {
                var path = Path.GetFullPath(Path.Combine(dir.FullName, candidate));
                if (File.Exists(Path.Combine(path, "appsettings.json")) &&
                    File.Exists(Path.Combine(path, "BPG.Api.csproj")))
                {
                    return path;
                }
            }
            dir = dir.Parent;
        }

        return null;
    }
}
