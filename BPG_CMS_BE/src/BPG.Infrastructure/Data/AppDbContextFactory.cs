using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BPG.Infrastructure.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        optionsBuilder.UseSqlServer(
"Server=DESKTOP-J9TCGNO\\SONNH;uid=sa;password=123456;database=BPGDB;Encrypt=True;TrustServerCertificate=True;"
        );

        return new AppDbContext(optionsBuilder.Options);
    }
}