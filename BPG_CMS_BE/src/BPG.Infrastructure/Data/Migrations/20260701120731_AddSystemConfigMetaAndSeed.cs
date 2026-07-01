using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemConfigMetaAndSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "SystemConfigs",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "SystemConfigs",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "SystemConfigs",
                type: "nvarchar(max)",
                nullable: true);

            // Seed initial config entries (INSERT if not exist)
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'inventory.low_stock_threshold')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('inventory.low_stock_threshold', '10', 'number',
        N'Ngưỡng tồn kho thấp',
        N'Số lượng tồn kho tối thiểu. Khi tồn kho thấp hơn ngưỡng này, hệ thống sẽ cảnh báo.',
        N'đơn vị', GETUTCDATE(), 0);

IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'task.delay_warning_percentage')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('task.delay_warning_percentage', '20', 'percentage',
        N'% trễ kỳ vọng công việc',
        N'Ngưỡng phần trăm thời gian trễ so với kế hoạch để kích hoạt cảnh báo trễ tiến độ.',
        N'%', GETUTCDATE(), 0);

IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'ticket.cancellation_deadline_hours')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('ticket.cancellation_deadline_hours', '24', 'number',
        N'Thời hạn hủy phiếu',
        N'Số giờ tối đa kể từ khi tạo phiếu mà kế toán/người dùng có thể hủy phiếu.',
        N'giờ', GETUTCDATE(), 0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "SystemConfigs");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "SystemConfigs");

            migrationBuilder.DropColumn(
                name: "Unit",
                table: "SystemConfigs");
        }
    }
}
