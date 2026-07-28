using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BPG.Infrastructure.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        optionsBuilder.UseSqlServer(
            "Server=localhost;Database=BPGDB;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=True;"
        );

        return new AppDbContext(optionsBuilder.Options);
    }
}