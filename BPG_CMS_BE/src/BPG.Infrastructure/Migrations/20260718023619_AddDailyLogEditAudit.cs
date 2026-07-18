using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyLogEditAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsEdited",
                table: "DailyLogs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastEditedAt",
                table: "DailyLogs",
                type: "datetime2",
                nullable: true);

            // Seed SystemConfig: số giờ được phép chỉnh sửa nhật ký thi công (mặc định 24h)
            migrationBuilder.Sql(
                "IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'DailyLogEditWindowHours') " +
                "INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted) " +
                "VALUES ('DailyLogEditWindowHours', '24', 'int', N'Số giờ chỉnh sửa nhật ký', N'Thời gian cho phép chỉnh sửa nhật ký thi công kể từ lúc tạo', N'giờ', GETUTCDATE(), 0);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsEdited",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "LastEditedAt",
                table: "DailyLogs");
        }
    }
}
