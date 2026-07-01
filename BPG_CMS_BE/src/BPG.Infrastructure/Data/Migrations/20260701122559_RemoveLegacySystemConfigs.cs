using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacySystemConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove legacy camelCase-keyed records that predate the new dot-notation keys
            migrationBuilder.Sql(
                "DELETE FROM SystemConfigs WHERE ConfigKey IN ('HanHuyPhieuNgay', 'NguongTonKhoThap', 'PhanTramTreKyVong');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Re-insert legacy records on rollback (approximate values)
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'HanHuyPhieuNgay')
    INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, CreatedAt, IsDeleted)
    VALUES ('HanHuyPhieuNgay', '7', 'int', '', GETUTCDATE(), 0);
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'NguongTonKhoThap')
    INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, CreatedAt, IsDeleted)
    VALUES ('NguongTonKhoThap', '10', 'decimal', '', GETUTCDATE(), 0);
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'PhanTramTreKyVong')
    INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, CreatedAt, IsDeleted)
    VALUES ('PhanTramTreKyVong', '15', 'decimal', '', GETUTCDATE(), 0);
");
        }
    }
}
