using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeDailyLogEditWindowHoursDataType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // DataType 'int' khiến UpdateSystemConfigCommandHandler bỏ qua validate số >= 0
            // (chỉ validate khi DataType là 'number'/'percentage'). Chuẩn hóa về 'number' để
            // đồng bộ với NguongTonKhoThap/HanHuyPhieuNgay.
            migrationBuilder.Sql(
                "UPDATE SystemConfigs SET DataType = 'number' WHERE ConfigKey = 'DailyLogEditWindowHours' AND DataType = 'int';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE SystemConfigs SET DataType = 'int' WHERE ConfigKey = 'DailyLogEditWindowHours' AND DataType = 'number';");
        }
    }
}
