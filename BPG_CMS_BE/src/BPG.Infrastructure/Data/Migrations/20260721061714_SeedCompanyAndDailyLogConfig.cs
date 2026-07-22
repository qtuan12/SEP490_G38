using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeedCompanyAndDailyLogConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Dọn key rác không được nghiệp vụ nào sử dụng
            migrationBuilder.Sql("DELETE FROM SystemConfigs WHERE ConfigKey = 'PhanTramTreKyVong';");

            // Bổ sung thông tin hiển thị còn thiếu cho 2 tham số nghiệp vụ đang dùng thật
            migrationBuilder.Sql(@"
UPDATE SystemConfigs SET DataType = 'number', DisplayName = N'Ngưỡng tồn kho thấp',
    Description = N'Số lượng tồn kho tối thiểu. Khi tồn kho thấp hơn ngưỡng này, hệ thống sẽ cảnh báo.', Unit = N'đơn vị'
WHERE ConfigKey = 'NguongTonKhoThap';

UPDATE SystemConfigs SET DataType = 'number', DisplayName = N'Hạn hủy phiếu nhập kho',
    Description = N'Số ngày tối đa kể từ khi tạo phiếu nhập kho mà người dùng có thể hủy phiếu.', Unit = N'ngày'
WHERE ConfigKey = 'HanHuyPhieuNgay';
");

            // Thêm tham số mới đang được handler đọc nhưng chưa có row trong DB
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'DailyLogEditWindowHours')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('DailyLogEditWindowHours', '24', 'number',
        N'Giờ được sửa nhật ký thi công',
        N'Số giờ kể từ lúc tạo mà kỹ sư còn được phép chỉnh sửa nhật ký thi công.',
        N'giờ', GETUTCDATE(), 0);
");

            // Thêm cấu hình thương hiệu công ty (tên + logo)
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'CompanyName')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('CompanyName', N'BPG CMS', 'string',
        N'Tên công ty',
        N'Tên công ty hiển thị trên sidebar và trang đăng nhập.',
        NULL, GETUTCDATE(), 0);

IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'CompanyLogoUrl')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('CompanyLogoUrl', '/logo.png', 'string',
        N'Logo công ty',
        N'URL logo hiển thị trên sidebar và trang đăng nhập.',
        NULL, GETUTCDATE(), 0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM SystemConfigs WHERE ConfigKey IN ('CompanyName', 'CompanyLogoUrl', 'DailyLogEditWindowHours');");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'PhanTramTreKyVong')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, CreatedAt, IsDeleted)
VALUES ('PhanTramTreKyVong', '15', 'decimal', '', GETUTCDATE(), 0);
");
        }
    }
}
